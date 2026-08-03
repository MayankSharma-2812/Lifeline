/**
 * @file prisma.js
 * @description Prisma ORM configuration. Provides a singleton instance of the PrismaClient for relational database operations.
 */
const { PrismaClient } = require('@prisma/client');

let prisma = null;

/**
 * Retrieves a singleton instance of the PrismaClient, initializing it if necessary.
 * @returns {PrismaClient} The PrismaClient instance used for database operations.
 */
function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

module.exports = { getPrisma };
