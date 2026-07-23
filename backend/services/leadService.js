const { prisma } = require('../config/database');
const { localDateKey, parseDateOnly } = require('../utils/date');
const { isUniqueConstraintError } = require('../utils/prisma');

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfTomorrow() {
  const tomorrow = startOfToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

function parseOptionalDate(value) {
  return value ? parseDateOnly(value) : null;
}

function isActiveStatus(status) {
  return !['WON', 'LOST', 'CLOSED'].includes(status);
}

function label(value) {
  return String(value || '')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function dateLabel(value) {
  if (!value) return 'No date';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function compactNote(note) {
  return String(note || '').replace(/\s+/g, ' ').trim().slice(0, 220);
}

function leadInclude(activityTake) {
  return {
    customer: true,
    payments: {
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    },
    activities: {
      ...(activityTake ? { take: activityTake } : {}),
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        admin: {
          select: {
            name: true,
          },
        },
      },
    },
  };
}

async function nextEnquiryNumber(tx, attempt = 0) {
  const prefix = `SSB-${localDateKey()}-`;
  const latest = await tx.quoteRequest.findFirst({
    where: {
      enquiryNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      enquiryNumber: 'desc',
    },
    select: {
      enquiryNumber: true,
    },
  });

  const latestSequence = latest ? Number(latest.enquiryNumber.slice(prefix.length)) : 0;
  const sequence = latestSequence + 1 + attempt;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

function serializeLead(lead) {
  return {
    id: lead.id,
    enquiryNumber: lead.enquiryNumber,
    customerName: lead.customer.name,
    phone: lead.customer.phone,
    email: lead.customer.email,
    company: lead.company,
    location: lead.customer.location,
    product: lead.product,
    quantity: lead.quantity,
    deliveryDate: lead.deliveryDate,
    source: lead.source,
    priority: lead.priority,
    status: lead.status,
    assignedTo: lead.assignedTo,
    nextFollowUpDate: lead.nextFollowUpDate,
    crmNotes: lead.crmNotes,
    finalAmount: lead.finalAmount === null ? null : Number(lead.finalAmount),
    paymentUrl: lead.paymentToken ? `/payment.html?token=${lead.paymentToken}` : null,
    paymentStatus: lead.payments?.find((payment) => payment.status === 'SUCCESS')?.status
      || lead.payments?.[0]?.status
      || 'NOT_CONFIGURED',
    payments: lead.payments?.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paymentId: payment.razorpayPaymentId,
      orderId: payment.razorpayOrderId,
      receiptUrl: payment.receiptUrl,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    })) || [],
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    activities: lead.activities?.map((activity) => ({
      id: activity.id,
      type: activity.type,
      note: activity.note,
      createdAt: activity.createdAt,
      createdBy: activity.admin?.name || null,
    })) || [],
  };
}

async function persistLead(payload, adminId, attempt = 0) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: {
        phone: payload.phone,
      },
      update: {
        name: payload.name,
        email: payload.email,
        location: payload.location,
      },
      create: {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        location: payload.location,
      },
    });

    const enquiryNumber = await nextEnquiryNumber(tx, attempt);
    const lead = await tx.quoteRequest.create({
      data: {
        enquiryNumber,
        customerId: customer.id,
        company: payload.company,
        product: payload.product,
        quantity: payload.quantity,
        deliveryDate: null,
        message: payload.notes,
        source: payload.source,
        status: payload.status || 'NEW',
        priority: payload.priority,
        assignedTo: payload.assignedTo,
        nextFollowUpDate: parseOptionalDate(payload.nextFollowUpDate),
        crmNotes: payload.notes,
        activities: {
          create: {
            type: payload.source === 'CSV_IMPORT' ? 'IMPORTED' : 'CREATED',
            note: payload.source === 'CSV_IMPORT' ? 'Lead imported.' : 'Lead created manually.',
            createdBy: adminId,
          },
        },
      },
      include: {
        customer: true,
        activities: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            admin: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return serializeLead(lead);
  });
}

async function createLead(payload, adminId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await persistLead(payload, adminId, attempt);
    } catch (error) {
      if (!isUniqueConstraintError(error) || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error('Unable to create a unique lead number.');
}

function parseLeadListOptions(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  const filter = String(query.filter || 'ALL').toUpperCase();
  const search = String(query.search || '').trim();
  return {
    page,
    limit,
    filter,
    search,
    skip: (page - 1) * limit,
  };
}

function leadWhere(options) {
  const today = startOfToday();
  const tomorrow = startOfTomorrow();
  const activeStatuses = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION'];
  const where = {};

  if (options.search) {
    where.OR = [
      { enquiryNumber: { contains: options.search, mode: 'insensitive' } },
      { product: { contains: options.search, mode: 'insensitive' } },
      { company: { contains: options.search, mode: 'insensitive' } },
      { customer: { name: { contains: options.search, mode: 'insensitive' } } },
      { customer: { phone: { contains: options.search } } },
    ];
  }

  const statusFilters = new Set(['NEW', 'CONTACTED', 'QUOTATION_SENT', 'WON', 'LOST']);
  if (statusFilters.has(options.filter)) {
    where.status = options.filter;
  } else if (options.filter === 'FOLLOW_UP_TODAY') {
    where.nextFollowUpDate = {
      gte: today,
      lt: tomorrow,
    };
    where.status = {
      in: activeStatuses,
    };
  } else if (options.filter === 'FOLLOW_UP_PENDING') {
    where.nextFollowUpDate = {
      gte: today,
    };
    where.status = {
      in: activeStatuses,
    };
  } else if (options.filter === 'IMPORTED' || options.filter === 'CSV_IMPORTS') {
    where.source = 'CSV_IMPORT';
  } else if (options.filter === 'HIGH_PRIORITY') {
    where.priority = 'HIGH';
  } else if (options.filter === 'WEBSITE_LEADS') {
    where.source = 'WEBSITE';
  }

  return where;
}

function leadSort(a, b) {
  const today = startOfToday();
  const aHigh = a.priority === 'HIGH' ? 0 : 1;
  const bHigh = b.priority === 'HIGH' ? 0 : 1;
  if (aHigh !== bHigh) return aHigh - bHigh;

  const aPending = a.nextFollowUpDate && a.nextFollowUpDate >= today && isActiveStatus(a.status) ? 0 : 1;
  const bPending = b.nextFollowUpDate && b.nextFollowUpDate >= today && isActiveStatus(b.status) ? 0 : 1;
  if (aPending !== bPending) return aPending - bPending;

  return b.createdAt.getTime() - a.createdAt.getTime();
}

async function listLeads(query = {}) {
  const options = parseLeadListOptions(query);
  const where = leadWhere(options);
  const [total, leads] = await Promise.all([
    prisma.quoteRequest.count({
      where,
    }),
    prisma.quoteRequest.findMany({
      where,
      include: leadInclude(5),
    }),
  ]);

  const sorted = leads.sort(leadSort);
  const pageRows = sorted.slice(options.skip, options.skip + options.limit);

  return {
    leads: pageRows.map(serializeLead),
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.max(Math.ceil(total / options.limit), 1),
    },
  };
}

async function getLeadById(leadId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  const lead = await prisma.quoteRequest.findUnique({
    where: {
      id,
    },
    include: leadInclude(),
  });

  if (!lead) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  return serializeLead(lead);
}

async function getLeadStats() {
  const today = startOfToday();
  const [todayLeads, totalLeads, pendingFollowUps, recentActivities] = await Promise.all([
    prisma.quoteRequest.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    }),
    prisma.quoteRequest.count(),
    prisma.quoteRequest.count({
      where: {
        nextFollowUpDate: {
          gte: today,
        },
        status: {
          in: ['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION'],
        },
      },
    }),
    prisma.leadActivity.findMany({
      take: 6,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        lead: {
          include: {
            customer: true,
          },
        },
        admin: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    todayLeads,
    totalLeads,
    pendingFollowUps,
    recentActivities: recentActivities.map((activity) => ({
      id: activity.id,
      leadId: activity.leadId,
      customerName: activity.lead.customer.name,
      note: activity.note,
      type: activity.type,
      createdAt: activity.createdAt,
      createdBy: activity.admin?.name || null,
    })),
  };
}

async function updateLeadStatus(leadId, payload, adminId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.quoteRequest.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
      },
    });

    if (!existing) {
      const error = new Error('Lead not found.');
      error.statusCode = 404;
      throw error;
    }

    const activityCreates = [];
    if (existing.status !== payload.status) {
      activityCreates.push({
        leadId: id,
        type: 'STATUS_CHANGE',
        note: `Status changed from ${label(existing.status)} to ${label(payload.status)}.`,
        createdBy: adminId,
      });
      if (payload.status === 'QUOTATION_SENT') {
        activityCreates.push({
          leadId: id,
          type: 'NOTE',
          note: 'Quotation sent.',
          createdBy: adminId,
        });
      }
    }

    const nextFollowUpDate = parseOptionalDate(payload.nextFollowUpDate);
    if (payload.nextFollowUpDate && String(existing.nextFollowUpDate || '') !== String(nextFollowUpDate)) {
      activityCreates.push({
        leadId: id,
        type: 'NOTE',
        note: `Follow-up scheduled for ${dateLabel(nextFollowUpDate)}.`,
        createdBy: adminId,
      });
    }

    if (payload.note) {
      activityCreates.push({
        leadId: id,
        type: 'NOTE',
        note: payload.note,
        createdBy: adminId,
      });
    }

    if (activityCreates.length) {
      await tx.leadActivity.createMany({
        data: activityCreates,
      });
    }

    const lead = await tx.quoteRequest.update({
      where: {
        id,
      },
      data: {
        status: payload.status,
        nextFollowUpDate,
        crmNotes: payload.note || existing.crmNotes,
      },
      include: leadInclude(5),
    });

    return serializeLead(lead);
  });
}

async function updateLead(leadId, payload, adminId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.quoteRequest.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
      },
    });

    if (!existing) {
      const error = new Error('Lead not found.');
      error.statusCode = 404;
      throw error;
    }

    const customer = await tx.customer.upsert({
      where: {
        phone: payload.phone,
      },
      update: {
        name: payload.name,
        email: payload.email,
        location: payload.location,
      },
      create: {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        location: payload.location,
      },
    });

    const nextFollowUpDate = parseOptionalDate(payload.nextFollowUpDate);
    const activityCreates = [];

    if (existing.status !== payload.status) {
      activityCreates.push({
        leadId: id,
        type: 'STATUS_CHANGE',
        note: `Status changed from ${label(existing.status)} to ${label(payload.status)}.`,
        createdBy: adminId,
      });
    }

    if (existing.priority !== payload.priority) {
      activityCreates.push({
        leadId: id,
        type: 'NOTE',
        note: `Priority changed from ${label(existing.priority)} to ${label(payload.priority)}.`,
        createdBy: adminId,
      });
    }

    if (String(existing.nextFollowUpDate || '') !== String(nextFollowUpDate || '')) {
      activityCreates.push({
        leadId: id,
        type: 'NOTE',
        note: nextFollowUpDate
          ? `Follow-up scheduled for ${dateLabel(nextFollowUpDate)}.`
          : 'Follow-up cleared.',
        createdBy: adminId,
      });
    }

    const nextNotes = payload.notes === undefined ? existing.crmNotes : payload.notes;
    if (payload.notes !== undefined && (existing.crmNotes || '') !== (payload.notes || '')) {
      activityCreates.push({
        leadId: id,
        type: 'NOTE',
        note: payload.notes ? 'CRM note edited.' : 'CRM note deleted.',
        createdBy: adminId,
      });
    }

    const coreChanged = existing.customer.name !== payload.name
      || existing.customer.phone !== payload.phone
      || (existing.customer.email || '') !== (payload.email || '')
      || existing.customer.location !== payload.location
      || (existing.company || '') !== (payload.company || '')
      || existing.product !== payload.product
      || existing.quantity !== payload.quantity
      || existing.source !== payload.source
      || (existing.assignedTo || '') !== (payload.assignedTo || '');

    if (coreChanged) {
      activityCreates.unshift({
        leadId: id,
        type: 'NOTE',
        note: 'Lead details updated.',
        createdBy: adminId,
      });
    }

    if (activityCreates.length) {
      await tx.leadActivity.createMany({
        data: activityCreates,
      });
    }

    const lead = await tx.quoteRequest.update({
      where: {
        id,
      },
      data: {
        customerId: customer.id,
        company: payload.company,
        product: payload.product,
        quantity: payload.quantity,
        source: payload.source,
        status: payload.status,
        priority: payload.priority,
        assignedTo: payload.assignedTo,
        nextFollowUpDate,
        crmNotes: nextNotes,
        message: nextNotes,
      },
      include: leadInclude(),
    });

    return serializeLead(lead);
  });
}

async function addLeadActivity(leadId, payload, adminId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.quoteRequest.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        crmNotes: true,
      },
    });

    if (!existing) {
      const error = new Error('Lead not found.');
      error.statusCode = 404;
      throw error;
    }

    const nextNotes = [existing.crmNotes, payload.note].filter(Boolean).join('\n\n');
    await tx.leadActivity.create({
      data: {
        leadId: id,
        type: 'NOTE',
        note: `Note added: ${compactNote(payload.note)}`,
        createdBy: adminId,
      },
    });

    const lead = await tx.quoteRequest.update({
      where: {
        id,
      },
      data: {
        crmNotes: nextNotes,
      },
      include: leadInclude(),
    });

    return serializeLead(lead);
  });
}

async function updateLeadPriority(leadId, payload, adminId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.quoteRequest.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
      },
    });

    if (!existing) {
      const error = new Error('Lead not found.');
      error.statusCode = 404;
      throw error;
    }

    if (existing.priority !== payload.priority) {
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: 'NOTE',
          note: `Priority changed from ${label(existing.priority)} to ${label(payload.priority)}.`,
          createdBy: adminId,
        },
      });
    }

    const lead = await tx.quoteRequest.update({
      where: {
        id,
      },
      data: {
        priority: payload.priority,
      },
      include: leadInclude(5),
    });

    return serializeLead(lead);
  });
}

async function updateLeadNotes(leadId, payload, adminId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.quoteRequest.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
      },
    });

    if (!existing) {
      const error = new Error('Lead not found.');
      error.statusCode = 404;
      throw error;
    }

    const notes = payload.notes || null;
    if ((existing.crmNotes || '') !== (notes || '')) {
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: 'NOTE',
          note: notes ? 'CRM note edited.' : 'CRM note deleted.',
          createdBy: adminId,
        },
      });
    }

    const lead = await tx.quoteRequest.update({
      where: {
        id,
      },
      data: {
        crmNotes: notes,
        message: notes,
      },
      include: leadInclude(),
    });

    return serializeLead(lead);
  });
}

async function deleteLead(leadId) {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('Lead not found.');
    error.statusCode = 404;
    throw error;
  }

  try {
    await prisma.quoteRequest.delete({
      where: {
        id,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      const notFound = new Error('Lead not found.');
      notFound.statusCode = 404;
      throw notFound;
    }
    throw error;
  }
}

async function findDuplicatePhones(rows, tx = prisma) {
  const phones = [...new Set(rows.map((row) => row.phone).filter(Boolean))];
  const customers = await tx.customer.findMany({
    where: {
      phone: {
        in: phones,
      },
    },
    select: {
      phone: true,
    },
  });
  return new Set(customers.map((customer) => customer.phone));
}

async function importLeads(rows, duplicateStrategy, adminId) {
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    importedAnyway: 0,
  };

  return prisma.$transaction(async (tx) => {
    const duplicatePhones = await findDuplicatePhones(rows, tx);
    const seenPhones = new Set();

    for (const row of rows) {
      const duplicateAction = row.duplicateAction || duplicateStrategy;
      const duplicateInFile = seenPhones.has(row.phone);
      const isDuplicate = duplicatePhones.has(row.phone) || duplicateInFile;
      const cleanRow = {
        ...row,
      };
      delete cleanRow.duplicateAction;

      if (row.phone) seenPhones.add(row.phone);

      if (isDuplicate && duplicateAction === 'SKIP') {
        summary.skipped += 1;
        continue;
      }

      if (isDuplicate && duplicateAction === 'UPDATE_EXISTING') {
        const existing = await tx.quoteRequest.findFirst({
          where: {
            customer: {
              phone: row.phone,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            customer: true,
          },
        });

        if (existing) {
          const customer = await tx.customer.upsert({
            where: {
              phone: cleanRow.phone,
            },
            update: {
              name: cleanRow.name,
              location: cleanRow.location,
            },
            create: {
              name: cleanRow.name,
              phone: cleanRow.phone,
              location: cleanRow.location,
            },
          });

          await tx.leadActivity.create({
            data: {
              leadId: existing.id,
              type: 'NOTE',
              note: 'Lead details updated from import.',
              createdBy: adminId,
            },
          });

          await tx.quoteRequest.update({
            where: {
              id: existing.id,
            },
            data: {
              customerId: customer.id,
              company: cleanRow.company,
              product: cleanRow.product,
              quantity: cleanRow.quantity,
              source: cleanRow.source || existing.source,
              status: existing.status,
              priority: cleanRow.priority,
              assignedTo: cleanRow.assignedTo,
              crmNotes: cleanRow.notes || existing.crmNotes,
              message: cleanRow.notes || existing.message,
            },
          });

          summary.updated += 1;
          continue;
        }
      }

      const customer = await tx.customer.upsert({
        where: {
          phone: cleanRow.phone,
        },
        update: {
          name: cleanRow.name,
          location: cleanRow.location,
        },
        create: {
          name: cleanRow.name,
          phone: cleanRow.phone,
          location: cleanRow.location,
        },
      });

      const enquiryNumber = await nextEnquiryNumber(tx);
      await tx.quoteRequest.create({
        data: {
          enquiryNumber,
          customerId: customer.id,
          company: cleanRow.company,
          product: cleanRow.product,
          quantity: cleanRow.quantity,
          deliveryDate: null,
          message: cleanRow.notes,
          source: cleanRow.source || 'CSV_IMPORT',
          status: cleanRow.status || 'NEW',
          priority: cleanRow.priority,
          assignedTo: cleanRow.assignedTo,
          crmNotes: cleanRow.notes,
          activities: {
            create: {
              type: 'IMPORTED',
              note: 'Lead imported.',
              createdBy: adminId,
            },
          },
        },
      });

      if (isDuplicate) {
        summary.importedAnyway += 1;
      } else {
        summary.created += 1;
      }
    }

    return summary;
  }, {
    maxWait: 5000,
    timeout: 30000,
  });
}

module.exports = {
  addLeadActivity,
  createLead,
  deleteLead,
  getLeadById,
  getLeadStats,
  importLeads,
  listLeads,
  updateLead,
  updateLeadNotes,
  updateLeadPriority,
  updateLeadStatus,
};
