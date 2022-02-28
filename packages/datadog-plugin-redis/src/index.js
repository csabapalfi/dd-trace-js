'use strict'

const Plugin = require('../../dd-trace/src/plugins/plugin')
const { storage } = require('../../datadog-core')
const analyticsSampler = require('../../dd-trace/src/analytics_sampler')
const urlFilter = require('../../dd-trace/src/plugins/util/urlfilter')

/**
 * @typedef { { [key: string]: unknown } } bag
 */

/**
 * @param {unknown} obj
 * @return {obj is bag}
 */
function isBag (obj) {
  if (typeof obj !== 'object') return false
  if (obj === null) return false

  return true
}

/**
 * @callback FilterFn
 * @param {string} cmd
 * @returns boolean

/**
 * @typedef { import('../../dd-trace/src/proxy') } TracerProxy
 * @typedef { import('../../dd-trace/src/plugins/plugin').PluginConfig } PluginConfig
 * @typedef { PluginConfig & {
 *             filter: (cmd: string) => boolean
 *           } } RedisPluginConfig
 */

/**
 * @override
 * @property {RedisPluginConfig} config
 */
class RedisPlugin extends Plugin {
  static get name () {
    return 'redis'
  }

  /**
   * @param {TracerProxy} tracer
   */
  constructor (tracer) {
    super(tracer)

    /** @type RedisPluginConfig | undefined */
    this.config

    this.addSub(`apm:${this.constructor.name}:command:start`, (
      opts
    ) => {
      if (!isBag(opts)) return this.skip()
      const { db, command, args, connectionOptions, connectionName } = opts
      if (!this.config || typeof command !== 'string' || !this.config.filter(command)) {
        return this.skip()
      }
      const store = storage.getStore()
      const childOf = store ? store.span : store
      const span = this.tracer.startSpan('redis.command', {
        childOf,
        tags: {
          'span.kind': 'client',
          'resource.name': command,
          'span.type': 'redis',
          'db.type': 'redis',
          'db.name': db || '0',
          'redis.raw_command': formatCommand(command, args)
        }
      })

      span.setTag('service.name', this.config.service || `${span.context()._tags['service.name']}-redis`)

      analyticsSampler.sample(span, this.config.measured)

      if (connectionOptions) {
        span.addTags({
          'out.host': connectionOptions.host,
          'out.port': connectionOptions.port
        })
      }

      if (this.config.splitByInstance && connectionName) {
        const service = this.config.service
          ? `${this.config.service}-${connectionName}`
          : connectionName

        span.setTag('service.name', service)
      }

      this.enter(span, store)
    })

    this.addSub(`apm:${this.constructor.name}:command:end`, () => {
      this.exit()
    })

    this.addSub(`apm:${this.constructor.name}:command:error`, err => {
      const span = storage.getStore().span
      span.setTag('error', err)
    })

    this.addSub(`apm:${this.constructor.name}:command:async-end`, () => {
      const span = storage.getStore().span
      span.finish()
    })
  }

  /**
   * @param {PluginConfig} config
   */
  configure (config) {
    super.configure(normalizeConfig(config))
  }
}

function formatCommand (command, args) {
  command = command.toUpperCase()

  if (!args || command === 'AUTH') return command

  for (let i = 0, l = args.length; i < l; i++) {
    if (typeof args[i] === 'function') continue

    command = `${command} ${formatArg(args[i])}`

    if (command.length > 1000) return trim(command, 1000)
  }

  return command
}

function formatArg (arg) {
  switch (typeof arg) {
    case 'string':
    case 'number':
      return trim(String(arg), 100)
    default:
      return '?'
  }
}

function trim (str, maxlen) {
  if (str.length > maxlen) {
    str = str.substr(0, maxlen - 3) + '...'
  }

  return str
}

/**
 * @param {PluginConfig} config
 * @return RedisPluginConfig
 */
function normalizeConfig (config) {
  const filter = urlFilter.getFilter(config)

  return Object.assign({}, config, {
    filter
  })
}

module.exports = RedisPlugin
