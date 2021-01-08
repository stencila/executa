use anyhow::{bail, Error, Result};
use std::str::FromStr;

#[derive(Debug, PartialEq)]
pub enum Protocol {
    #[cfg(any(feature = "delegate-stdio", feature = "serve-stdio"))]
    Stdio,
    #[cfg(any(feature = "delegate-http", feature = "serve-http"))]
    Http,
    #[cfg(any(feature = "delegate-ws", feature = "serve-ws"))]
    Ws,
}

impl FromStr for Protocol {
    type Err = Error;
    fn from_str(protocol: &str) -> Result<Self> {
        match protocol.to_lowercase().as_str() {
            #[cfg(any(feature = "delegate-http", feature = "serve-http"))]
            "http" => Ok(Protocol::Http),
            #[cfg(any(feature = "delegate-ws", feature = "serve-ws"))]
            "ws" => Ok(Protocol::Ws),
            #[cfg(any(feature = "delegate-stdio", feature = "serve-stdio"))]
            "stdio" => Ok(Protocol::Stdio),
            _ => bail!("Invalid protocol identifier: {}", protocol),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn from_str() {
        for item in vec!["stdio", "STDIO"] {
            assert_eq!(Protocol::from_str(item), Ok(Protocol::Stdio));
        }
        for item in vec!["http", "HTTP"] {
            assert_eq!(Protocol::from_str(item), Ok(Protocol::Http));
        }
        for item in vec!["ws", "WS"] {
            assert_eq!(Protocol::from_str(item), Ok(Protocol::Ws));
        }
        assert_eq!(
            Protocol::from_str("foo"),
            bail!("Invalid protocol identifier: foo")
        )
    }
}
