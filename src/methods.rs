use anyhow::{bail, Error, Result};
use serde::Serialize;
use std::str::FromStr;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Method {
    Decode,
    Encode,
}

impl FromStr for Method {
    type Err = Error;
    fn from_str(protocol: &str) -> Result<Self> {
        match protocol.to_lowercase().as_str() {
            "decode" => Ok(Method::Decode),
            "encode" => Ok(Method::Encode),
            _ => bail!("Invalid method identifier: {}", protocol),
        }
    }
}
