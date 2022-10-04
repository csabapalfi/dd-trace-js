'use strict'

const { isTrue, isFalse, isTrueOrFalse } = require('../src/util')

const TRUES = [
  1,
  true,
  'true',
  'TRUE',
  'tRuE'
]
const FALSES = [
  0,
  false,
  'false',
  'FALSE',
  'fAlSe'
]
const OTHERS = [
  undefined,
  null,
  'michel',
  42,
  NaN
]

describe('util', () => {
  it('isTrue works', () => {
    TRUES.forEach((v) => {
      expect(isTrue(v)).to.equal(true)
      expect(isTrue(String(v))).to.equal(true)
    })
    FALSES.forEach((v) => {
      expect(isTrue(v)).to.equal(false)
      expect(isTrue(String(v))).to.equal(false)
    })
  })

  it('isFalse works', () => {
    FALSES.forEach((v) => {
      expect(isFalse(v)).to.equal(true)
      expect(isFalse(String(v))).to.equal(true)
    })
    TRUES.forEach((v) => {
      expect(isFalse(v)).to.equal(false)
      expect(isFalse(String(v))).to.equal(false)
    })
  })

  it('isTrueOrFalse works', () => {
    TRUES.forEach((v) => {
      expect(isTrueOrFalse(v)).to.equal(true)
      expect(isTrueOrFalse(String(v))).to.equal(true)
    })
    FALSES.forEach((v) => {
      expect(isTrueOrFalse(v)).to.equal(false)
      expect(isTrueOrFalse(String(v))).to.equal(false)
    })
    OTHERS.forEach((v) => {
      expect(isTrueOrFalse(v)).to.equal(undefined)
      expect(isTrueOrFalse(String(v))).to.equal(undefined)
    })
  })
})
