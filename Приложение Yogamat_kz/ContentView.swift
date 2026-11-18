//
//  ContentView.swift
//  Приложение Yogamat_kz
//

import SwiftUI

struct ContentView: View {
    @State private var store = StudioStore()

    var body: some View {
        Group {
            if store.currentUser != nil {
                RootView()
            } else {
                AuthView()
            }
        }
        .environment(store)
        .preferredColorScheme(.light)
        .task {
            store.maintainAutomaticBackup()
        }
    }
}

#Preview {
    ContentView()
}
