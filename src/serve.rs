use crate::decode;
use crate::err;
use crate::error::Error;
use crate::nodes::Node;
use crate::protocols::Protocol;
use crate::result::Result;
use crate::rpc::{Request, Response};

use futures::{FutureExt, StreamExt};

pub fn serve(
    protocol: Option<Protocol>,
    address: Option<String>,
    port: Option<u16>,
) -> Result<Node> {
    let protocol = protocol.unwrap_or(if cfg!(feature = "serve-stdio") {
        Protocol::Stdio
    } else if cfg!(feature = "serve-http") {
        Protocol::Http
    } else if cfg!(feature = "serve-ws") {
        Protocol::Ws
    } else {
        return err!("There are no serve-* features enabled");
    });

    let address: std::net::IpAddr = address.unwrap_or_else(|| "127.0.0.1".to_string()).parse()?;

    let port = port.unwrap_or(9000);

    match protocol {
        Protocol::Stdio => todo!(),
        Protocol::Http | Protocol::Ws => {
            let mut runtime = tokio::runtime::Builder::new()
                .basic_scheduler()
                .enable_all()
                .build()
                .expect("Failed to build runtime");

            runtime.block_on(async move {
                use warp::Filter;

                let post = warp::path::end()
                    .and(warp::post())
                    .and(warp::body::json::<Request>())
                    .map(post_handler);

                let post_wrap = warp::path::param()
                    .and(warp::post())
                    .and(warp::body::json::<serde_json::Value>())
                    .map(post_wrap_handler);

                let ws = warp::path::end().and(warp::ws()).map(ws_handler);

                let routes = post
                    .or(post_wrap)
                    .or(ws)
                    .with(warp::cors().allow_any_origin());

                warp::serve(routes).run((address, port)).await;
            });

            Ok(Node::Null)
        }
    }
}

fn post_handler(request: Request) -> impl warp::Reply {
    let response = respond(request);
    warp::reply::json(&response)
}

fn post_wrap_handler(method: String, params: serde_json::Value) -> impl warp::Reply {
    // TODO: Return a plain string (not a JSON response) for errors

    // Wrap the method and parameters into a request
    let request = serde_json::from_value::<Request>(serde_json::json!({
        "method": method,
        "params": params
    }));
    let request = match request {
        Ok(request) => request,
        Err(error) => {
            return warp::reply::with_status(
                warp::reply::json(&error.to_string()),
                warp::http::StatusCode::BAD_REQUEST,
            )
        }
    };

    // Unwrap the response into results or error message
    let Response { result, error, .. } = respond(request);
    match result {
        Some(result) => {
            warp::reply::with_status(warp::reply::json(&result), warp::http::StatusCode::OK)
        }
        None => match error {
            Some(error) => {
                warp::reply::with_status(
                    warp::reply::json(&error.message),
                    // TODO Choose the status code based on the JSON-RPC error code
                    warp::http::StatusCode::BAD_REQUEST,
                )
            }
            None => warp::reply::with_status(
                warp::reply::json(&"Response had neither a result nor an error".to_string()),
                warp::http::StatusCode::INTERNAL_SERVER_ERROR,
            ),
        },
    }
}

fn ws_handler(ws: warp::ws::Ws) -> impl warp::Reply {
    ws.on_upgrade(|socket| {
        // TODO Currently just echos
        let (tx, rx) = socket.split();
        rx.forward(tx).map(|result| {
            if let Err(e) = result {
                eprintln!("websocket error: {:?}", e);
            }
        })
    })
}

fn respond(request: Request) -> Response {
    let id = Request::id(&request);
    let result = match request {
        Request::Decode(request) => decode::rpc::decode(request.params),
    };
    match result {
        Ok(node) => Response::new(id, Some(node), None),
        Err(error) => Response::new(id, None, Some(error)),
    }
}

#[cfg(feature = "cli")]
pub mod cli {
    use super::*;
    use structopt::StructOpt;
    #[derive(Debug, StructOpt)]
    #[structopt(about = "Serve an executor using HTTP, WebSockets, or Standard I/O")]
    pub struct Args {
        /// Transport protocol to use (defaults to `stdio`)
        #[structopt(short = "t", long, env = "EXECUTA_PROTOCOL", case_insensitive = true)]
        protocol: Option<Protocol>,

        /// Address to listen on (HTTP and Websockets only, defaults to "127.0.0.1")
        #[structopt(short, long, env = "EXECUTA_ADDRESS")]
        address: Option<String>,

        /// Port to listen on (HTTP and Websockets only, defaults to 9000)
        #[structopt(short, long, env = "EXECUTA_PORT")]
        port: Option<u16>,
    }

    pub fn serve(args: Args) -> Result<Node> {
        let Args {
            protocol,
            address,
            port,
        } = args;

        super::serve(protocol, address, port)
    }
}
