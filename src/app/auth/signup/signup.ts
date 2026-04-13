import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { auth, db } from '../../../firebase';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-sans flex items-center justify-center px-6 py-12">
      <div class="max-w-md w-full">
        <div class="text-center mb-10">
          <div class="text-3xl font-bold tracking-tighter mb-2">KIT GIZMO</div>
          <p class="text-gray-400">Create your account to start growing today.</p>
        </div>

        <form (submit)="onSubmit()" class="space-y-5">
          @if (errorMessage()) {
            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {{ errorMessage() }}
            </div>
          }

          @if (successMessage()) {
            <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
              {{ successMessage() }}
            </div>
          }

          <div class="space-y-2">
            <label for="fullName" class="text-sm font-medium text-gray-400">Full Name</label>
            <div class="relative">
              <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">person</mat-icon>
              <input 
                id="fullName"
                type="text" 
                [(ngModel)]="fullName" 
                name="fullName"
                required
                class="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all"
                placeholder="John Doe"
              >
            </div>
          </div>

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
                placeholder="Min. 8 characters"
              >
            </div>
          </div>

          <div class="space-y-2">
            <label for="confirmPassword" class="text-sm font-medium text-gray-400">Confirm Password</label>
            <div class="relative">
              <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">lock_reset</mat-icon>
              <input 
                id="confirmPassword"
                type="password" 
                [(ngModel)]="confirmPassword" 
                name="confirmPassword"
                required
                class="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] outline-none transition-all"
                placeholder="Repeat password"
              >
            </div>
          </div>

          <button 
            type="submit" 
            [disabled]="isLoading()"
            class="w-full py-4 bg-[#38BDF8] text-[#020617] font-bold rounded-xl hover:bg-[#38BDF8]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {{ isLoading() ? 'Creating account...' : 'Create Account' }}
          </button>
        </form>

        <div class="mt-8 text-center text-gray-400 text-sm">
          Already have an account? 
          <a routerLink="/login" class="text-[#38BDF8] hover:underline font-medium">Login</a>
        </div>

        <div class="mt-4 text-center">
          <a routerLink="/" class="text-gray-500 hover:text-white text-xs transition-colors">← Back to Home</a>
        </div>
      </div>
    </div>
  `,
  styles: ``,
})
export class SignupComponent {
  private router = inject(Router);
  
  fullName = '';
  email = '';
  password = '';
  confirmPassword = '';
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  async onSubmit() {
    if (!this.fullName || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage.set('Password must be at least 8 characters long.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, this.email, this.password);
      const user = userCredential.user;

      // 2. Update Auth Profile
      await updateProfile(user, { displayName: this.fullName });

      // 3. Send Verification Email
      await sendEmailVerification(user);

      // 4. Create Firestore Profile
      const role = this.email === 'info.kitgizmo@gmail.com' ? 'admin' : 'user';
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName: this.fullName,
        email: this.email,
        role: role,
        status: 'active',
        balance: 0,
        totalSpent: 0,
        createdAt: serverTimestamp()
      });

      this.successMessage.set('Account created! Please check your email for a verification link.');
      
      // 5. Redirect to Dashboard after a short delay
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 3000);
    } catch (error: unknown) {
      console.error('Signup error:', error);
      const errorCode = (error as { code?: string }).code || '';
      this.errorMessage.set(this.getFriendlyErrorMessage(errorCode));
    } finally {
      this.isLoading.set(false);
    }
  }

  private getFriendlyErrorMessage(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled.';
      case 'auth/weak-password':
        return 'The password is too weak.';
      default:
        return 'An error occurred during sign up. Please try again.';
    }
  }
}
