#[cfg(feature = "delegate")]
use crate::delegate::*;

use crate::err;
use crate::error::Error;
use crate::nodes::Node;
use crate::result::Result;

// Allow these for when no formats are enabled
#[allow(unused_variables, unreachable_code)]
pub fn decode(input: String, format: String) -> Result<Node> {
    let node = match format.as_str() {
        #[cfg(feature = "json")]
        "json" => serde_json::from_str::<Node>(input.as_str())?,
        #[cfg(feature = "yaml")]
        "yaml" => serde_yaml::from_str::<Node>(input.as_str())?,
        _ => {
            #[cfg(feature = "delegate")]
            return delegate(
                Method::Decode,
                rpc::Params {
                    input,
                    format: Some(format),
                },
            );

            #[cfg(not(feature = "delegate"))]
            return err!("Unable to"); // TODO
        }
    };

    Ok(node)
}

#[cfg(any(feature = "delegate", feature = "serve"))]
pub mod rpc {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    pub struct Params {
        pub input: String,

        pub format: Option<String>,
    }

    pub fn decode(params: Params) -> Result<Node> {
        let Params { input, format } = params;
        super::decode(input, format.unwrap_or_default())
    }
}

#[cfg(feature = "cli")]
pub mod cli {
    use super::*;
    use structopt::StructOpt;

    #[derive(Debug, StructOpt)]
    #[structopt(
        about = "Decode", // TODO about
        setting = structopt::clap::AppSettings::DeriveDisplayOrder
    )]
    pub struct Args {
        /// TODO docs
        input: String,

        /// TODO docs
        #[structopt(short, long)]
        format: Option<String>,
    }

    pub fn decode(args: Args) -> Result<Node> {
        let Args { input, format } = args;

        super::decode(input, format.unwrap_or_default())
    }
}
