// Features

#[cfg(feature = "cli")]
pub mod cli;

#[cfg(feature = "serve")]
pub mod serve;

#[cfg(feature = "delegate")]
pub mod delegate;

// Methods

//pub mod coerce;
//pub mod convert;
pub mod decode;
//pub mod encode;
pub mod validate;

// Utilities

mod error;
mod nodes;
mod protocols;
mod result;
mod rpc;
