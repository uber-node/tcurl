# tcurl

<!--
    [![build status][build-png]][build]
    [![Coverage Status][cover-png]][cover]
    [![Davis Dependency status][dep-png]][dep]
-->

<!-- [![NPM][npm-png]][npm] -->

A command line utility to talk to a tchannel server.

```
usage: tcurl [OPTIONS] service endpoint

Options:
  -h --help                 Show detailed manpage
  -v --version              Print version
  -H --hostlist             Path to hostlist file
  -p --peer                 IP and port of single peer
  -t --thrift               Path to thrift IDL file
  -2 --head <value>         Set header to <value>
  -3 --body <value>         Set body to <value>
     --http <method>        Use HTTP <method> instead of TCP
     --health               Print health for <service>
     --raw                  Send header and body as binary diaray
     --shardKey             Send Ringpop shardKey transport header
     --no-strict            Parse thrift IDL files loosely
     --timeout <value>      Set a timeout value in milliseconds
```

[Click here for full usage docs.](usage.md)

## Installation

`npm install tcurl --global`

## NPM scripts

 - `npm run add-licence` This will add the licence headers.
 - `npm run cover` This runs the tests with code coverage
 - `npm run lint` This will run the linter on your code
 - `npm run man` This will build the manpage. 
 - `npm test` This will run the tests.
 - `npm run trace` This will run your tests in tracing mode.
 - `npm run travis` This is run by travis.CI to run your tests
 - `npm run view-cover` This will show code coverage in a browser

## Contributors

 - Raynos
 - ShanniLi
 - kriskowal
 - malandrew

## MIT Licenced

  [build-png]: https://secure.travis-ci.org/uber/tcurl.png
  [build]: https://travis-ci.org/uber/tcurl
  [cover-png]: https://coveralls.io/repos/uber/tcurl/badge.png
  [cover]: https://coveralls.io/r/uber/tcurl
  [dep-png]: https://david-dm.org/uber/tcurl.png
  [dep]: https://david-dm.org/uber/tcurl
  [test-png]: https://ci.testling.com/uber/tcurl.png
  [tes]: https://ci.testling.com/uber/tcurl
  [npm-png]: https://nodei.co/npm/tcurl.png?stars&downloads
  [npm]: https://nodei.co/npm/tcurl
