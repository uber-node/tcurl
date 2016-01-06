# tcurl(1) -- curl for tchannel

## SYNOPSIS

    tcurl <service> <method> [<body>]
          [-t | --thrift | -j | --json | -r | --raw | --http]
          [--rate] [--requests] [--time] [--delay]
          [--timeout] [--sk] [--rd]
    tcurl <service> --health
    tcurl [-h | --help | -v | --version]

## DESCRIPTION

`tcurl` is a tool for constructing and sending requests to
a tchannel service. It supports thrift, JSON, and raw request format.

## EXAMPLES

 - `tcurl -p localhost:8080 service --health`
 - `tcurl -p localhost:8080 service endpoint --raw 'message'`
 - `tcurl hyperbahn Hyperbahn::discover --body '{"query":{"serviceName":"ringpop"}}' -t ./hyperbahn.thrift`
 - `tcurl hyperbahn Hyperbahn::discover [ --query [ --serviceName ringpop ] ] -t ./hyperbahn.thrift`

## OPTIONS

`-p host:port <service> <endpoint>`

Specify the destination where the request should be sent to including the host,
the port, the serviceName, and the endpoint.  When used with `--health`,
endpoint is not required.  You can specify any number of peers and TChannel
will choose one for each request.

`-P <peer-file> <serviceName> <endpoint>`

Similar to the `-p` option. Instead of the host:port, it takes a peer-file that
contains a list of host:port where this request can be sent to.  TChannel will
only pick one host:port to send the request to.

The peer list file must be a JSON array of host:port strings.

`--health`

Send a health check request to a sevice that implements the "Meta::health"
health check endpoint.  For example:

    tcurl -p 127.0.0.1:21300 serviceName --heath

It is the same as:

    tcurl -p 127.0.0.1:21300 serviceName Meta::health -t meta.thrift

`-2 | --arg2 | --head <content>`

Specify the head (a.k.a. arg2) of the request. The content can be either a raw
string or a JSON string depending on the request format.

You can also provide the headers in SHON format as a positional argument
(without the `--head` flag).

    tcurl curly Stooges::nyuck [ --nyuck [ --name tcurl --language js ] ] \
        -t curly.thrift

`-3 | --arg3 | --body <content>`

Specify the body (a.k.a. arg3) of the request. The content can be either a raw
string or a JSON string depending on the request format.

An example of a JSON string would be:

    {"query":{"serviceName":"ringpop"}}

These can also be expressed in SHON (SHell Object Notation) with a positional
argument (without the `--body` flag).

    [ --query [ --serviceName ringpop ] ]

The corresponding thrift IDL format is:

    struct DiscoveryQuery {
      1: required string serviceName
    }

    service Hyperbahn {
        DiscoveryResult discover(
            1: required DiscoveryQuery query
        )
    }

`-t <thrift>`

Used with the thrift encoding to specify the path to the thrift files.  The
thrift option value can either point to a file or a directory.  For example:

    tcurl -p 127.0.0.1:21300 serviceName Meta::health -t . null

The above command assumes that current folder contains the meta.thrift IDL file.

`--no-strict`

Disable the default strict mode of thrift parsing. When strict mode is enabled,
all fields must be specified as either "required" or "optional".

`--raw`

Use raw format (i.e. plain text) for request.

`--http <method>`

Send an http request described in the form of tchannel.  For example:

    tcurl -p 127.0.0.1:21300 echoServer /echo
        --http=POST 'Hello World!' --headers [ --Accept text/plain ]

`--shard-key <sk>` or `--sk <sk>`

Route to the worker that owns this key within a DHT.

`--routing-delegate` or `--rd <rd>`

Route through the delegated service.

`--timeout <value>`

Specify the maximum time in miniseconds this request can take until it timeout.
For example, the following command specifies a timeout value of one second:

    tcurl -p 127.0.0.1:8080 serviceName endpoint --timeout 1000

`--rate <value>`

This option is required in order to use the benchmark mode, where the same
request is sent multiple times to the server.  It specifies the number of
requests sent at each batch.  For example, the following command sends health
check requests to a service at the rate of 1000, i.e., send 1000 requests and
wait until the requests all complete before sending the next 1000.

    tcurl -p localhost:8080 serviceName --health --rate 1000

`--delay <value>`

Specify the time in milliseconds it should delay between each batch.  For
example, the following command delays 100ms between each batch send.

    tcurl -p localhost:8080 serviceName --health --rate 1000 --delay 100

`--requests <value>`

Specify the total number of requests that can be sent in benchmark mode. By
default, there is no limit on the number of requests that can be sent.

`--time <value>`

Specify the time in milliseconds how long the benchmark should run.  When no
request limit is set, the default value is 30 seconds. Otherwise, the default
is unlimited.

`-h`

View abbreviated usage information.

`--help`

View the man page.

`-v | --version`

Print the current version.


## FILES

TCurl can be configured with default parameters using a either /etc/tcurlrc or
a .tcurlrc in the current working directory or any of its parent directories.
The rc file may be in INI or JSON format.

    {
        "hostlist": "/etc/ringpop/hosts.json"
    }

`hostlist` is the fully qualified path of a JSON file containing an array of
host:port strings.

## EXIT CODES

- 0: for all successful requests
- 1: timeout
- 2: cancelled
- 3: busy
- 4: declined
- 5: unexpected error
- 6: bad request
- 7: network error
- 8: unhealthy (broken circuit)
- 124: unhealthy / not OK thrift response
- 125: misc tcurl / tchannel internal error
- 126: response not ok error
- 127: fatal protocol error


## BUGS

Please report any bugs to https://github.com/uber/tcurl

## LICENCE

MIT Licenced

## SEE ALSO

 - TChannel: https://github.com/uber/tchannel
 - Hyperbahn: https://github.com/uber/hyperbahn
 - Ringpop: https://github.com/uber/ringpop-node
 - SHON: https://github.com/kriskowal/shon
