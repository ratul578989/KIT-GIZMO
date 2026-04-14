import {ChangeDetectionStrategy, Component, signal, OnInit, WritableSignal, inject, PLATFORM_ID, OnDestroy} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {CommonModule, isPlatformBrowser} from '@angular/common';
import { RouterModule } from '@angular/router';
import { animate, stagger, inView } from "motion";
import { auth, db } from '../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, collection, query, where, orderBy, getDoc, getDocs } from 'firebase/firestore';

interface SiteSettings {
  instagramUrl: string;
  showInstagramCard: boolean;
}

interface Marketplace {
  id: string;
  name: string;
  logoUrl: string;
  redirectUrl: string;
  isActive: boolean;
  order: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home',
  standalone: true,
  imports: [MatIconModule, CommonModule, RouterModule],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  
  users = signal(0);
  projects = signal(0);
  clients = signal(0);
  rating = signal(0);
  
  currentUser = signal<User | null>(null);
  isAuthReady = signal(false);
  siteSettings = signal<SiteSettings>({ instagramUrl: '', showInstagramCard: false });
  marketplaces = signal<Marketplace[]>([]);
  
  private unsubscribers: (() => void)[] = [];

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const authUnsub = onAuthStateChanged(auth, (user) => {
        this.currentUser.set(user);
        this.isAuthReady.set(true);
      });
      this.unsubscribers.push(authUnsub);

      // Real-time Site Settings
      getDoc(doc(db, 'site_settings', 'main')).then(snap => {
        if (snap.exists()) {
          this.siteSettings.set(snap.data() as SiteSettings);
        }
      });

      // Real-time Marketplaces
      const marketplacesQ = query(
        collection(db, 'marketplaces'),
        where('isActive', '==', true),
        orderBy('order', 'asc')
      );
      getDocs(marketplacesQ).then(snap => {
        this.marketplaces.set(snap.docs.map((doc) => doc.data() as Marketplace));
      });

      // Scroll-triggered animations for Trust Stats
      inView("#trust-stats", () => {
        animate(
          "#trust-stats h2",
          { opacity: [0, 1], y: [20, 0] },
          { duration: 0.8, ease: "easeOut" }
        );
        
        animate(
          ".trust-card",
          { opacity: [0, 1], y: [30, 0] },
          { delay: stagger(0.15), duration: 0.8, ease: "easeOut" }
        );

        // Start counters when section is in view
        this.animateCounter(this.users, 1200000, 2000);
        this.animateCounter(this.projects, 750000, 2000);
        this.animateCounter(this.clients, 150000, 2000);
        this.animateCounter(this.rating, 5, 2000, true);
      });

      // Scroll-triggered animations for AI Performance
      inView("#ai-performance", () => {
        animate(
          ".ai-header",
          { opacity: [0, 1], y: [20, 0] },
          { duration: 0.8, ease: "easeOut" }
        );
        
        animate(
          ".ai-sub",
          { opacity: [0, 1], y: [20, 0] },
          { delay: 0.2, duration: 0.8, ease: "easeOut" }
        );

        animate(
          ".comp-card",
          { opacity: [0, 1], y: [40, 0] },
          { delay: (i: number) => 0.4 + i * 0.2, duration: 0.8, ease: "easeOut" }
        );

        animate(
          ".feature-card",
          { opacity: [0, 1], scale: [0.9, 1] },
          { delay: (i: number) => 0.8 + i * 0.1, duration: 0.6, ease: "easeOut" }
        );
      });
    } else {
      // Set final values immediately on server for SEO/Initial load
      this.users.set(1200000);
      this.projects.set(750000);
      this.clients.set(150000);
      this.rating.set(5);
    }
  }

  private animateCounter(signal: WritableSignal<number>, target: number, duration: number, isFloat = false) {
    const start = 0;
    const startTime = performance.now();

    const update = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuad = (t: number) => t * (2 - t);
      const val = start + (target - start) * easeOutQuad(progress);
      const current = isFloat ? Math.round(val * 10) / 10 : Math.floor(val);
      
      signal.set(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  }

  ngOnDestroy() {
    this.unsubscribers.forEach(unsub => unsub());
  }
}
