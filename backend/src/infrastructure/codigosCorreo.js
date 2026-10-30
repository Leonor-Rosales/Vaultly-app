const { randomInt, randomUUID } = require('node:crypto');
module.exports = { generar: () => String(randomInt(0, 1000000)).padStart(6, '0'), id: randomUUID };
