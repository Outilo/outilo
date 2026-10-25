// Pas de console supplémentaire en release sous Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    outilo_lib::run()
}
