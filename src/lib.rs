// Features

#[cfg(feature = "cli")]
pub mod cli;

#[cfg(feature = "request")]
pub mod request;

#[cfg(feature = "serve")]
pub mod serve;

// Methods

pub mod delegate;
//pub mod convert;
pub mod decode;
pub mod encode;
pub mod validate;

// Utilities

mod methods;
mod nodes;
mod protocols;
mod rpc;
