export default () => ({
  database: {
    url: process.env.DATABASE_URL || 'postgresql://admin:password123@localhost:5432/ecommerce?schema=public',
  },
});