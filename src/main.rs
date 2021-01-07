#[cfg(not(tarpaulin_include))]
pub fn main() {
    use std::process::exit;

    #[cfg(feature = "cli")]
    exit(executa::cli::cli(None));

    #[cfg(all(feature = "serve", not(feature = "cli")))]
    exit(match executa::serve::serve(None, None, None) {
        Ok(_) => 0,
        Err(error) => {
            eprintln!("Error: {}", error);
            1
        }
    });

    #[cfg(not(any(feature = "serve", feature = "cli")))]
    {
        eprintln!("Warning: neither `cli` nor `serve` features enabled, nothing to do.");
        exit(0)
    }
}
