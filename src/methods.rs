use anyhow::{bail, Error, Result};
use std::str::FromStr;

#[derive(Debug, PartialEq)]
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
