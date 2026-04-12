import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { auth, db } from '../../firebase';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-sans flex">
      <!-- Sidebar -->
      <aside class="w-64 border-r border-white/10 flex flex-col">
        <div class="p-6 text-2xl font-bold tracking-tighter border-b border-white/10">KIT GIZMO</div>
        
        <nav class="flex-1 p-4 space-y-2">
          <a routerLink="/dashboard" class="flex items-center gap-3 p-3 bg-[#38BDF8]/10 text-[#38BDF8] rounded-xl font-medium">
            <mat-icon>dashboard</mat-icon>
            Dashboard
          </a>
          <a class="flex items-center gap-3 p-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all cursor-not-allowed">
            <mat-icon>shopping_cart</mat-icon>
            Orders
          </a>
          <a class="flex items-center gap-3 p-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all cursor-not-allowed">
            <mat-icon>account_balance_wallet</mat-icon>
            Add Funds
          </a>
        </nav>

        <div class="p-4 border-t border-white/10">
          <button (click)="logout()" class="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <mat-icon>logout</mat-icon>
            Logout
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto">
        <!-- Top Nav -->
        <header class="h-20 border-b border-white/10 flex items-center justify-between px-8">
          <h1 class="text-xl font-semibold">User Dashboard</h1>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-sm font-medium">{{ userProfile()?.['fullName'] || 'User' }}</div>
              <div class="text-xs text-gray-500 capitalize">{{ userProfile()?.['role'] || 'Member' }}</div>
            </div>
            <div class="w-10 h-10 rounded-full bg-[#38BDF8] flex items-center justify-center text-[#020617] font-bold">
              {{ (userProfile()?.['fullName']?.toString() || 'U').charAt(0).toUpperCase() }}
            </div>
          </div>
        </header>

        <!-- Content Area -->
        <div class="p-8">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div class="text-gray-400 text-sm mb-2">Total Balance</div>
              <div class="text-3xl font-bold">$0.00</div>
            </div>
            <div class="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div class="text-gray-400 text-sm mb-2">Active Orders</div>
              <div class="text-3xl font-bold">0</div>
            </div>
            <div class="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div class="text-gray-400 text-sm mb-2">Total Spent</div>
              <div class="text-3xl font-bold">$0.00</div>
            </div>
          </div>

          <div class="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <mat-icon class="text-gray-600 text-6xl mb-4 h-auto w-auto">inbox</mat-icon>
            <h2 class="text-xl font-semibold mb-2">No Recent Activity</h2>
            <p class="text-gray-500 max-w-md mx-auto">You haven't placed any orders yet. Start growing your social media presence today!</p>
            <button class="mt-6 px-6 py-3 bg-[#38BDF8] text-[#020617] font-bold rounded-xl hover:bg-[#38BDF8]/90 transition-all">
              Place New Order
            </button>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: ``,
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
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

  async logout() {
    try {
      await signOut(auth);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
