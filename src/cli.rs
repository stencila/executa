use crate::decode;
use crate::nodes::Node;
use crate::request;
use crate::serve;
use crate::validate;
use anyhow::Result;
use structopt::StructOpt;

#[derive(Debug, StructOpt)]
#[structopt(
    about = "Executors for stencils",
    setting = structopt::clap::AppSettings::DeriveDisplayOrder
)]
pub enum Commands {
    Decode(decode::cli::Args),
    Validate(validate::cli::Args),
    Request(request::cli::Args),
    Serve(serve::cli::Args),
}

pub fn cli(out: Option<&mut dyn std::io::Write>) -> i32 {
    // Allow an output writer to be passed in but default to stdout
    // This allows unit testing of output
    let stdout: &mut dyn std::io::Write = &mut std::io::stdout();
    let out = out.unwrap_or(stdout);

    // TODO Get args from passed vector of strings
    let args = Commands::from_args();
    let node = match args {
        Commands::Decode(args) => decode::cli::decode(args),
        Commands::Validate(args) => validate::cli::validate(args),
        Commands::Request(args) => request::cli::request(args),
        Commands::Serve(args) => serve::cli::serve(args),
    };
    match node {
        Ok(node) => {
            // Render nodes to the terminal
            // TODO allow user to send output to a file in a particular format e.g. a `Table` to CSV
            match node {
                // Don't do anything with `null` values
                Node::Null => {}
                // Write everything else to the terminal
                _ => {
                    let rendered = render(node).unwrap();
                    writeln!(out, "{}", rendered).unwrap()
                }
            }
            exitcode::OK
        }
        Err(error) => {
            // Write the error to the terminal
            // TODO Send this to a logger
            writeln!(out, "{}", error).unwrap();
            exitcode::SOFTWARE
        }
    }
}

// TODO More rendering specializations e.g. Heading, CodeBlocks, Tables
fn render(node: Node) -> Result<String> {
    match node {
        Node::String(string) => Ok(string),
        _ => Ok(serde_json::to_string_pretty(&node)?),
    }
}
