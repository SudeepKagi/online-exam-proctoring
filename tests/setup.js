'use strict'

const { guardTestDatabase } = require('./helpers/env')

guardTestDatabase()

module.exports = {
  guardTestDatabase
}
