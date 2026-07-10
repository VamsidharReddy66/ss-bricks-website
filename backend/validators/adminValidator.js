const { z } = require('zod');

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .email('Enter a valid email address.')
    .max(255, 'Email must be 255 characters or fewer.')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(128, 'Password must be 128 characters or fewer.'),
  rememberMe: z.boolean().optional().default(false),
});

module.exports = {
  loginSchema,
};
