use crate::methods::Method;
use crate::nodes::Node;
use crate::rpc::Response;
use anyhow::{anyhow, bail, Result};
use regex::Regex;
use std::str::FromStr;

#[cfg(feature = "cli")]
pub mod cli {
    use super::*;
    use structopt::StructOpt;

    #[derive(Debug, StructOpt)]
    #[structopt(
        about = "Request a method call on a peer",
        setting = structopt::clap::AppSettings::DeriveDisplayOrder
    )]
    pub struct Args {
        /// URL of the peer (e.g. ws://example.org:9001, :9000)
        url: String,

        /// Method name
        method: String,

        /// Method parameters
        #[structopt(raw(true))]
        params: Vec<String>,
    }

    pub async fn request(args: Args) -> Result<Node> {
        let Args {
            url,
            method,
            params,
        } = args;

        let method = Method::from_str(&method)?;

        let mut object = serde_json::json!({});
        for param in params {
            let parts: Vec<&str> = param.split('=').collect();
            let (name, value) = (parts[0], parts[1]);
            object[name] = match serde_json::from_str(value) {
                Ok(value) => value,
                Err(_) => serde_json::Value::String(value.to_string()),
            };
        }

        super::request(url, method, object).await
    }
}

pub async fn request(url: String, method: Method, params: serde_json::Value) -> Result<Node> {
    // Ensure that url is fully formed and parse it
    let url = if url.starts_with(':') {
        format!("http://127.0.0.1{}", url)
    } else {
        let re = Regex::new("https?|wss?").unwrap();
        match re.captures(&url) {
            Some(_) => url,
            None => format!("http://{}", url),
        }
    };

    println!("{} {:?} {}", url, method, params);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }))
        .send()
        .await?
        .json::<Response>()
        .await?;

    let Response { result, error, .. } = response;
    match result {
        Some(result) => Ok(result),
        None => match error {
            Some(error) => Err(anyhow!(error.message)),
            None => bail!("Response has neither a result nor an error"),
        },
    }
}
