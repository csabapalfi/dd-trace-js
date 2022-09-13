'use strict'

const addresses = require('./addresses')
const Limiter = require('../rate_limiter')

// default limiter, configurable with setRateLimit()
let limiter = new Limiter(100)

const REQUEST_HEADERS_PASSLIST = [
  'accept',
  'accept-encoding',
  'accept-language',
  'content-encoding',
  'content-language',
  'content-length',
  'content-type',
  'forwarded',
  'forwarded-for',
  'host',
  'true-client-ip',
  'user-agent',
  'via',
  'x-client-ip',
  'x-cluster-client-ip',
  'x-forwarded',
  'x-forwarded-for',
  'x-real-ip'
]

const RESPONSE_HEADERS_PASSLIST = [
  'content-encoding',
  'content-language',
  'content-length',
  'content-type'
]

function resolveHTTPRequest (context) {
  if (!context) return {}

  const headers = context.resolve(addresses.HTTP_INCOMING_HEADERS)

  return {
    remote_ip: context.resolve(addresses.HTTP_INCOMING_REMOTE_IP),
    headers: filterHeaders(headers, REQUEST_HEADERS_PASSLIST, 'http.request.headers.')
  }
}

function resolveHTTPResponse (context) {
  if (!context) return {}

  const headers = context.resolve(addresses.HTTP_INCOMING_RESPONSE_HEADERS)

  return {
    endpoint: context.resolve(addresses.HTTP_INCOMING_ENDPOINT),
    headers: filterHeaders(headers, RESPONSE_HEADERS_PASSLIST, 'http.response.headers.')
  }
}

function filterHeaders (headers, passlist, prefix) {
  const result = {}

  if (!headers) return result

  for (let i = 0; i < passlist.length; ++i) {
    const headerName = passlist[i]

    if (headers[headerName]) {
      result[`${prefix}${formatHeaderName(headerName)}`] = headers[headerName] + ''
    }
  }

  return result
}

// TODO: this can be precomputed at start time
function formatHeaderName (name) {
  return name
    .trim()
    .slice(0, 200)
    .replace(/[^a-zA-Z0-9_\-:/]/g, '_')
    .toLowerCase()
}

function reportAttack (attackData, store) {
  const req = store && store.get('req')
  const topSpan = req && req._datadog && req._datadog.span
  if (!topSpan) return false

  const currentTags = topSpan.context()._tags

  const newTags = {
    'appsec.event': 'true'
  }

  if (limiter.isAllowed()) {
    newTags['manual.keep'] = 'true' // TODO: figure out how to keep appsec traces with sampling revamp
  }

  // the library must not modify the trace’s priority and origin fields if the priority is already strictly greater than 0
  // TODO: maybe add this to format.js later (to take decision as late as possible)
  if (!currentTags['_dd.origin']) {
    newTags['_dd.origin'] = 'appsec'
  }

  const currentJson = currentTags['_dd.appsec.json']

  // merge JSON arrays without parsing them
  if (currentJson) {
    newTags['_dd.appsec.json'] = currentJson.slice(0, -2) + ',' + attackData.slice(1, -1) + currentJson.slice(-2)
  } else {
    newTags['_dd.appsec.json'] = '{"triggers":' + attackData + '}'
  }

  const context = store.get('context')

  if (context) {
    const resolvedRequest = resolveHTTPRequest(context)

    Object.assign(newTags, resolvedRequest.headers)

    const ua = resolvedRequest.headers['http.request.headers.user-agent']
    if (ua) {
      newTags['http.useragent'] = ua
    }

    newTags['network.client.ip'] = resolvedRequest.remote_ip
  }

  topSpan.addTags(newTags)
}

function finishAttacks (req, context) {
  const topSpan = req && req._datadog && req._datadog.span
  if (!topSpan || !context) return false

  const resolvedResponse = resolveHTTPResponse(context)

  const newTags = resolvedResponse.headers

  if (resolvedResponse.endpoint) {
    newTags['http.endpoint'] = resolvedResponse.endpoint
  }

  topSpan.addTags(newTags)
}

function setRateLimit (rateLimit) {
  limiter = new Limiter(rateLimit)
}

module.exports = {
  resolveHTTPRequest,
  resolveHTTPResponse,
  filterHeaders,
  formatHeaderName,
  reportAttack,
  finishAttacks,
  setRateLimit
}
