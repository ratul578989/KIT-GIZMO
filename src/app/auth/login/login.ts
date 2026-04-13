import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { auth, db } from '../../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-sans flex items-center justify-center px-6">
      <div class="max-w-md w-full">
        <div class="text-center mb-10">
          <div class="text-3xl font-bold tracking-tighter mb-2">KIT GIZMO</div>
          <p class="text-gray-400">Welcome back! Please login to your account.</p>
        </div>

        <form (submit)="onSubmit()" class="space-y-6">
          @if (errorMessage()) {
            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {{ errorMessage() }}
            </div>
          }

          <div class="space-y-2">
            <label for="email" class="text-sm font-medium text-gray-400">Email Address</label>
            <div class="relative">
              <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">email</mat-icon>
              <input 
                id="email"
                type="email" 
                [(ngModel)]="email" 
                name="email"
                required
                class="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all"
                placeholder="name@example.com"
              >
            </div>
          </div>

          <div class="space-y-2">
            <label for="password" class="text-sm font-medium text-gray-400">Password</label>
            <div class="relative">
              <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">lock</mat-icon>
              <input 
                id="password"
                type="password" 
                [(ngModel)]="password" 
                name="password"
                required
                class="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all"
                placeholder="••••••••"
              >
            </div>
          </div>

          <button 
            type="submit" 
            [disabled]="isLoading()"
            class="w-full py-4 bg-[#38BDF8] text-[#020617] font-bold rounded-xl hover:bg-[#38BDF8]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isLoading() ? 'Logging in...' : 'Login' }}
          </button>
        </form>

        <div class="mt-8 text-center text-gray-400 text-sm">
          Don't have an account? 
          <a routerLink="/signup" class="text-[#38BDF8] hover:underline font-medium">Sign Up</a>
        </div>
        
        <div class="mt-4 text-center">
          <a routerLink="/" class="text-gray-500 hover:text-white text-xs transition-colors">← Back to Home</a>
        </div>
      </div>
    </div>
  `,
  styles: ``,
})
export class LoginComponent {
  private router = inject(Router);
  
  email = '';
  password = '';
  isLoading = signal(false);
  errorMessage = signal('');

  async onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, this.email, this.password);
      const user = userCredential.user;
      
      // Update lastLogin and lastActive (use setDoc with merge: true in case doc doesn't exist)
      await setDoc(doc(db, 'users', user.uid), {
        lastLogin: serverTimestamp(),
        lastActive: serverTimestamp()
      }, { merge: true });

      this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorCode = (error as { code?: string }).code || '';
      this.errorMessage.set(this.getFriendlyErrorMessage(errorCode));
    } finally {
      this.isLoading.set(false);
    }
  }

  private getFriendlyErrorMessage(code: string): string {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return 'An error occurred during login. Please try again.';
    }
  }
}
