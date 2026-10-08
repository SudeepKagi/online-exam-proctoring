'use strict'

const { guardTestDatabase } = require('./helpers/env')

guardTestDatabase()

module.exports = async function globalSetup() {
  guardTestDatabase()
}
