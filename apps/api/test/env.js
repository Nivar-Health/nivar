// Must be imported before anything that reads config: points the API at the isolated test database.
process.env.NODE_ENV = 'test';
process.env.MONGO_URL = process.env.TEST_MONGO_URL || 'mongodb://localhost:27018/nivar_test';
if (!/_test(\?|$)/.test(process.env.MONGO_URL)) {
  throw new Error(`Refusing to run tests against a non-test database: ${process.env.MONGO_URL}`);
}
