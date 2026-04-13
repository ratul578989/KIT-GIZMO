import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-sans flex">
      <!-- Sidebar (Reusing Dashboard Sidebar) -->
      <aside class="w-64 border-r border-white/10 flex flex-col">
        <div class="p-6 text-2xl font-bold tracking-tighter border-b border-white/10 text-[#38BDF8]">KIT GIZMO</div>
        
        <nav class="flex-1 p-4 space-y-2">
          <a routerLink="/dashboard" class="flex items-center gap-3 p-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all">
            <mat-icon>dashboard</mat-icon>
            Dashboard
          </a>
          <a routerLink="/profile" class="flex items-center gap-3 p-3 bg-[#38BDF8]/10 text-[#38BDF8] rounded-xl font-medium">
            <mat-icon>person</mat-icon>
            Profile
          </a>
          <a routerLink="/dashboard" class="flex items-center gap-3 p-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all">
            <mat-icon>arrow_back</mat-icon>
            Back to Dashboard
          </a>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto">
        <header class="h-20 border-b border-white/10 flex items-center justify-between px-8">
          <h1 class="text-xl font-semibold">My Profile</h1>
        </header>

        <div class="p-8 max-w-2xl">
          <div class="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-8">
            <div class="flex items-center gap-6">
              <div class="w-24 h-24 rounded-full bg-[#38BDF8] flex items-center justify-center text-[#020617] text-3xl font-bold">
                {{ (userProfile()?.['fullName']?.toString() || 'U').charAt(0).toUpperCase() }}
              </div>
              <div>
                <h2 class="text-2xl font-bold">{{ userProfile()?.['fullName'] || 'Loading...' }}</h2>
                <p class="text-gray-400 capitalize">{{ userProfile()?.['role'] || 'Member' }}</p>
              </div>
            </div>

            <div class="grid gap-6">
              <div class="space-y-1">
                <div class="text-sm text-gray-500 font-medium">Full Name</div>
                <div class="text-lg">{{ userProfile()?.['fullName'] || '---' }}</div>
              </div>

              <div class="space-y-1">
                <div class="text-sm text-gray-500 font-medium">Email Address</div>
                <div class="text-lg">{{ userProfile()?.['email'] || '---' }}</div>
              </div>

              <div class="space-y-1">
                <div class="text-sm text-gray-500 font-medium">Join Date</div>
                <div class="text-lg">
                  {{ $any(userProfile()?.['createdAt'])?.toDate() | date:'longDate' }}
                </div>
              </div>
            </div>

            <div class="pt-6 border-t border-white/10">
              <button routerLink="/dashboard" class="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-sm font-medium">
                Edit Profile (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: ``,
})
export class ProfileComponent implements OnInit {
  userProfile = signal<Record<string, unknown> | null>(null);

  ngOnInit() {
    onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          this.userProfile.set(docSnap.data() as Record<string, unknown>);
        }
      }
    });
  }
}
