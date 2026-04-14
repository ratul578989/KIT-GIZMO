import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { auth, db } from '../../../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-sans flex items-center justify-center px-6">
      <div class="max-w-md w-full">
        <div class="text-center mb-10">
          <div class="text-3xl font-bold tracking-tighter mb-2 text-[#22D3EE]">KIT GIZMO</div>
          <p class="text-gray-400">Welcome back! Please login to your account.</p>
        </div>

        <form (submit)="onSubmit()" class="space-y-6">
          @if (errorMessage()) {
            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              {{ errorMessage() }}
              @if (showResendVerification()) {
                <button type="button" (click)="resendVerification()" class="block mt-2 text-[#22D3EE] hover:underline font-bold">Resend verification email?</button>
              }
            </div>
          }

          @if (successMessage()) {
            <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2">
              {{ successMessage() }}
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
                class="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 pl-12 pr-4 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] outline-none transition-all"
                placeholder="name@example.com"
              >
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label for="password" class="text-sm font-medium text-gray-400">Password</label>
              <button type="button" (click)="forgotPassword()" class="text-xs text-[#22D3EE] hover:underline">Forgot password?</button>
            </div>
            <div class="relative">
              <mat-icon class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">lock</mat-icon>
              <input 
                id="password"
                type="password" 
                [(ngModel)]="password" 
                name="password"
                required
                class="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 pl-12 pr-4 focus:border-[#22D3EE] focus:ring-1 focus:ring-[#22D3EE] outline-none transition-all"
                placeholder="••••••••"
              >
            </div>
          </div>

          <button 
            type="submit" 
            [disabled]="isLoading()"
            class="w-full py-4 bg-[#22D3EE] text-[#020617] font-bold rounded-xl hover:bg-[#22D3EE]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#22D3EE]/20"
          >
            {{ isLoading() ? 'Logging in...' : 'Login' }}
          </button>
        </form>

        <div class="mt-6">
          <div class="relative flex items-center justify-center mb-6">
            <div class="flex-grow border-t border-white/10"></div>
            <span class="px-4 text-xs text-gray-500 uppercase tracking-widest bg-[#020617]">Or continue with</span>
            <div class="flex-grow border-t border-white/10"></div>
          </div>

          <button 
            (click)="loginWithGoogle()"
            [disabled]="isLoading()"
            class="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-3"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </div>

        <div class="mt-8 text-center text-gray-400 text-sm">
          Don't have an account? 
          <a routerLink="/signup" class="text-[#22D3EE] hover:underline font-medium">Sign Up</a>
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
  successMessage = signal('');
  showResendVerification = signal(false);

  async onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.showResendVerification.set(false);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, this.email, this.password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        this.showResendVerification.set(true);
      }

      await this.handlePostLogin(user);
      this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorCode = this.extractErrorCode(error);
      this.errorMessage.set(this.getFriendlyErrorMessage(errorCode));
      
      if (errorCode === 'auth/invalid-credential') {
        // Suggest password reset if credentials fail
        this.errorMessage.set('Invalid email or password. If you forgot your password, click "Forgot password?" above.');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async resendVerification() {
    this.isLoading.set(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        this.successMessage.set('Verification email resent! Please check your inbox.');
        this.showResendVerification.set(false);
      }
    } catch (error: unknown) {
      console.error('Resend verification error:', error);
      this.errorMessage.set('Failed to resend verification email. Please try again later.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loginWithGoogle() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if user exists in Firestore, if not create profile
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const role = user.email === 'info.kitgizmo@gmail.com' ? 'admin' : 'user';
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          fullName: user.displayName || 'User',
          email: user.email,
          role: role,
          status: 'active',
          balance: 0,
          totalSpent: 0,
          createdAt: serverTimestamp()
        });
      }

      await this.handlePostLogin(user);
      this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      console.error('Google login error:', error);
      const errorCode = this.extractErrorCode(error);
      if (errorCode !== 'auth/popup-closed-by-user') {
        this.errorMessage.set(this.getFriendlyErrorMessage(errorCode));
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async forgotPassword() {
    if (!this.email) {
      this.errorMessage.set('Please enter your email address first.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await sendPasswordResetEmail(auth, this.email);
      this.successMessage.set('Password reset email sent! Please check your inbox.');
    } catch (error: unknown) {
      console.error('Reset password error:', error);
      const errorCode = this.extractErrorCode(error);
      this.errorMessage.set(this.getFriendlyErrorMessage(errorCode));
    } finally {
      this.isLoading.set(false);
    }
  }

  private async handlePostLogin(user: { uid: string }) {
    await setDoc(doc(db, 'users', user.uid), {
      lastLogin: serverTimestamp(),
      lastActive: serverTimestamp()
    }, { merge: true });
  }

  private extractErrorCode(error: unknown): string {
    const err = error as { code?: string, message?: string };
    if (err.code) return err.code;
    if (err.message && err.message.includes('auth/')) {
      return err.message.match(/auth\/[a-z-]+/)?.[0] || '';
    }
    return '';
  }

  private getFriendlyErrorMessage(code: string): string {
    if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      return 'Invalid email or password. Please verify your credentials. If you have not created an account yet, please sign up.';
    }

    switch (code) {
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Your account has been temporarily locked. Please try again later or reset your password.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-blocked':
        return 'Login popup was blocked by your browser. Please allow popups for this site.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/internal-error':
        return 'A temporary server error occurred. Please try again in a few moments.';
      default:
        console.warn('Unhandled Firebase Auth error code:', code);
        return 'An error occurred during login. Please try again or contact support.';
    }
  }
}
