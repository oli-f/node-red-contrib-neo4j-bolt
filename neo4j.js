const neo4j = require('neo4j-driver').v1
module.exports = function (RED) {
  function Neo4jBolt (config) {
    RED.nodes.createNode(this, config)
    var node = this

    node.server = RED.nodes.getNode(config.server)

    const driver = node.server.driver
    const session = driver.session()

    if (session) {
      node.status({
        fill: 'green',
        shape: 'dot',
        text: 'node-red:common.status.connected'
      })
      node.on('input', function (msg) {
        var query = config.query || msg.query
        let params = null
        if (typeof (msg.params) === 'string') {
          params = JSON.parse(msg.params)
        } else {
          params = msg.params
        }
        var scalar_result = {
          payload: null
        }
        const resultPromise = session.run(query, params)

        var array_result = {
          payload: []
        }

        function processInteger (integer) {
          if (integer.constructor.name === 'Integer') {
            return integer.toNumber()
          }
          return integer
        }

        function processRecord (record) {
          if (record.constructor.name === 'Integer') {
            return record.toNumber()
          }

          if (record.constructor.name === 'Path') {
            record.start.identity = processInteger(record.start.identity)
            record.end.identity = processInteger(record.end.identity)
            record.segments = record.segments.map(segment => {

              segment.start.identity = processInteger(segment.start.identity)
              segment.end.identity = processInteger(segment.end.identity)

              segment.relationship.identity = processInteger(segment.relationship.identity)
              segment.relationship.start = processInteger(segment.relationship.start)
              segment.relationship.end = processInteger(segment.relationship.end)

              return segment
            })
            return record
          }

          if (record.constructor.name === 'Relationship') {
            record.identity = processInteger(record.identity)
            record.start = processInteger(record.start)
            record.end = processInteger(record.end)
            return record
          }

          if (record.constructor.name === 'Node') {
            record.identity = processInteger(record.identity)
            return record
          }

          return record
        }
        resultPromise.then(result => {
          session.close()
          if (result.records.length > 1) {
            result.records.forEach(function (item, index, array) {
              array_result.payload.push(processRecord(item.get(0)))
            })
            node.send([null, array_result])
          } else {
            scalar_result.payload = processRecord(result.records[0].get(0))
            node.send([scalar_result, null])
          }
        })
      })
    } else {
      node.status({
        fill: 'red',
        shape: 'dot',
        text: 'node-red:common.status.disconnected'
      })
    }

    node.on('close', function () {
      driver.close()
    })
  }
  RED.nodes.registerType('neo4j-bolt', Neo4jBolt)
}
