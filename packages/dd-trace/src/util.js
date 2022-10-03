'use strict'

function isTrue (str) {
  str = String(str).toLowerCase()
  return str === 'true' || str === '1'
}

function isFalse (str) {
  str = String(str).toLowerCase()
  return str === 'false' || str === '0'
}

function isTrueOrFalse (str) {
  if (isTrue(str)) return true
  if (isFalse(str)) return false
  return undefined
}

function isError (value) {
  if (value instanceof Error) {
    return true
  }
  if (value && value.message && value.stack) {
    return true
  }
  return false
}

module.exports = {
  isTrue,
  isFalse,
  isTrueOrFalse,
  isError
}
