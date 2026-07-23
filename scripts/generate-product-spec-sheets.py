from io import BytesIO
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as ReportLabImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"

MAROON = colors.HexColor("#6B1713")
RED = colors.HexColor("#A72F22")
CHARCOAL = colors.HexColor("#2F2A26")
TAUPE = colors.HexColor("#8A7E73")
CREAM = colors.HexColor("#F5F1EA")
CREAM_DARK = colors.HexColor("#E2D8CB")
WHITE = colors.white

PRODUCTS = [
    {
        "name": "Fly Ash Bricks",
        "slug": "fly-ash-bricks",
        "image": "fly-ash-bricks.png",
        "dimensions": "9 x 4.5 x 3 inches",
        "weight": "2.2-2.8 kg per unit",
        "strength": "15-17.5 N/mm2",
        "absorption": "12-15%",
        "standard": "SS Bricks product catalogue",
        "note": (
            "Dimensions, unit weight, compressive strength, and water absorption "
            "follow the supplied SS Bricks product catalogue."
        ),
    },
    {
        "name": "Solid Cement Blocks",
        "slug": "solid-cement-blocks",
        "image": "solid-cement-blocks.png",
        "dimensions": "12 x 8-9 x 6 inches",
        "weight": "18-20 kg per unit",
        "strength": "10 N/mm2",
        "absorption": "6-9%",
        "standard": "SS Bricks product catalogue - standard block",
        "note": (
            "Values apply to the standard solid cement block shown in the supplied "
            "SS Bricks product catalogue."
        ),
    },
    {
        "name": "Paver Blocks",
        "slug": "paver-blocks",
        "image": "paver-blocks.png",
        "dimensions": "9 x 4.5 x 3 inches",
        "weight": "2.2-2.5 kg per unit",
        "strength": "16-18 N/mm2",
        "absorption": "10-12%",
        "standard": "SS Bricks product catalogue - standard paver",
        "note": (
            "Dimensions and weight refer to the illustrated standard paver. "
            "Colour, shape, and finish variants should be confirmed when ordering."
        ),
    },
    {
        "name": "Mud Bricks",
        "slug": "mud-bricks",
        "image": "mud-bricks.png",
        "dimensions": "9 x 4.5 x 3 inches",
        "weight": "2.8-3 kg per unit",
        "strength": "10-12 N/mm2",
        "absorption": "9-12%",
        "standard": "SS Bricks product catalogue - compressed mud brick",
        "note": (
            "Values refer to the compressed mud brick shown in the supplied "
            "SS Bricks product catalogue."
        ),
    },
]


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "Brand",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=18,
        textColor=MAROON,
    )
)
styles.add(
    ParagraphStyle(
        "ProductTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=25,
        leading=29,
        textColor=CHARCOAL,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        "Eyebrow",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=RED,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        "Section",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=MAROON,
        spaceBefore=4,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        "BodySmall",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=CHARCOAL,
    )
)
styles.add(
    ParagraphStyle(
        "Muted",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=TAUPE,
    )
)
styles.add(
    ParagraphStyle(
        "CentreSmall",
        parent=styles["BodySmall"],
        alignment=TA_CENTER,
    )
)


def branded_header():
    mark = Table([["", ""], ["", ""]], colWidths=[5 * mm] * 2, rowHeights=[5 * mm] * 2)
    mark.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), MAROON),
                ("BOX", (0, 0), (-1, -1), 1, MAROON),
                ("INNERGRID", (0, 0), (-1, -1), 1.2, WHITE),
            ]
        )
    )
    brand = Table(
        [
            [
                mark,
                [
                    Paragraph("SS Bricks", styles["Brand"]),
                    Paragraph("Tirupati, Andhra Pradesh", styles["Muted"]),
                ],
            ]
        ],
        colWidths=[14 * mm, 145 * mm],
    )
    brand.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return brand


def product_image(path):
    buffer = BytesIO()
    with PILImage.open(path) as source:
        source.convert("RGB").resize((700, 700), PILImage.Resampling.LANCZOS).save(
            buffer,
            format="JPEG",
            quality=84,
            optimize=True,
        )
    buffer.seek(0)
    image = ReportLabImage(buffer, width=52 * mm, height=52 * mm, kind="proportional")
    image._source_buffer = buffer
    image.hAlign = "CENTER"
    return image


def specs_table(rows):
    data = [
        [Paragraph(f"<b>{label}</b>", styles["BodySmall"]), Paragraph(value, styles["BodySmall"])]
        for label, value in rows
    ]
    table = Table(data, colWidths=[52 * mm, 107 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), CREAM_DARK),
                ("BACKGROUND", (1, 0), (1, -1), CREAM),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D2C7BA")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def footer(canvas, _doc):
    canvas.saveState()
    canvas.setStrokeColor(CREAM_DARK)
    canvas.line(24 * mm, 17 * mm, 186 * mm, 17 * mm)
    canvas.setFillColor(TAUPE)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(
        24 * mm,
        11 * mm,
        "SS Blocks, Tiruchanoor Rd, SV Auto Nagar, Tirupati, Andhra Pradesh 517501",
    )
    canvas.drawRightString(186 * mm, 11 * mm, "888 610 0063 | 888 610 0065")
    canvas.restoreState()


def generate(product):
    output_path = OUTPUT / f"ss-bricks-{product['slug']}-specification-v1.pdf"
    document = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=24 * mm,
        rightMargin=24 * mm,
        topMargin=18 * mm,
        bottomMargin=23 * mm,
        title=f"{product['name']} Specification Sheet",
        author="SS Bricks",
        subject="Catalogue-based product specification",
    )

    intro = Table(
        [
            [
                [
                    Paragraph("Physical Product Data", styles["Section"]),
                    Paragraph(
                        "Dimensions and unit-weight ranges follow the SS Bricks catalogue supplied for publication.",
                        styles["BodySmall"],
                    ),
                ],
                product_image(ROOT / "images" / product["image"]),
            ]
        ],
        colWidths=[101 * mm, 58 * mm],
    )
    intro.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.75, CREAM_DARK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )

    note = Table(
        [[Paragraph(product["note"], styles["BodySmall"])]],
        colWidths=[159 * mm],
    )
    note.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8F5F0")),
                ("BOX", (0, 0), (-1, -1), 0.75, CREAM_DARK),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )

    story = [
        branded_header(),
        Spacer(1, 8 * mm),
        Paragraph("PRODUCT SPECIFICATION - VERSION 1.0", styles["Eyebrow"]),
        Paragraph(product["name"], styles["ProductTitle"]),
        Paragraph("Catalogue reference sheet | Issued 23 July 2026", styles["Muted"]),
        Spacer(1, 7 * mm),
        intro,
        Spacer(1, 7 * mm),
        Paragraph("Physical Specifications", styles["Section"]),
        specs_table(
            [
                ("Dimensions", product["dimensions"]),
                ("Unit Weight", product["weight"]),
            ]
        ),
        Spacer(1, 6 * mm),
        Paragraph("Performance Information", styles["Section"]),
        specs_table(
            [
                ("Compressive Strength", product["strength"]),
                ("Water Absorption", product["absorption"]),
                ("Reference / Standard", product["standard"]),
            ]
        ),
        Spacer(1, 6 * mm),
        Paragraph("Product Note", styles["Section"]),
        note,
        Spacer(1, 6 * mm),
        Paragraph(
            "For retail comparison only. Confirm the current product variant, availability, transport requirements, and project suitability with SS Bricks before ordering.",
            styles["Muted"],
        ),
    ]

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output_path


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for product in PRODUCTS:
        print(generate(product))


if __name__ == "__main__":
    main()
