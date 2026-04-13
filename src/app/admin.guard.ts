import { inject, Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private router = inject(Router);

  async isAdmin(): Promise<boolean> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
        unsubscribe();
        if (!user) {
          resolve(false);
          return;
        }

        // Check if user is the specific admin email
        if (user.email === 'info.kitgizmo@gmail.com') {
          resolve(true);
          return;
        }

        // Double check Firestore role
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data()['role'] === 'admin') {
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          resolve(false);
        }
      });
    });
  }
}

export const adminGuard: CanActivateFn = async () => {
  const adminService = inject(AdminService);
  const router = inject(Router);
  const isAdmin = await adminService.isAdmin();

  if (isAdmin) {
    return true;
  } else {
    router.navigate(['/dashboard'], { queryParams: { error: 'access-denied' } });
    return false;
  }
};
