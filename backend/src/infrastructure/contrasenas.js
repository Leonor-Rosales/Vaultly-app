const bcrypt = require('bcryptjs');

const hashear = (password) => bcrypt.hash(password, 10);
const comparar = (password, hash) => bcrypt.compare(password, hash);

module.exports = { hashear, comparar };
