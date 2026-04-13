import { Component, inject, signal, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { auth, db } from '../../firebase';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, collection, query, where, onSnapshot, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import * as d3 from 'd3';

interface Order {
  id: string;
  userId: string;
  category: string;
  service: string;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  createdAt: Timestamp | null;
}

interface UserProfile {
  fullName?: string;
  role?: string;
  balance?: number;
  totalSpent?: number;
  totalDeposit?: number;
  [key: string]: unknown;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, FormsModule],
  templateUrl: './dashboard.html',
  styles: [`
    .chart-container {
      width: 100%;
      height: 300px;
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  userProfile = signal<UserProfile | null>(null);
  orders = signal<Order[]>([]);
  
  isSidebarOpen = signal(false);
  isAdmin = signal(false);
  expandedMenus = signal<Record<string, boolean>>({
    'orders': false,
    'dripfeed': false,
    'deposit': false,
    'profile': false
  });

  stats = computed(() => {
    const allOrders = this.orders();
    return {
      balance: this.userProfile()?.['balance'] || 0,
      totalSpent: this.userProfile()?.['totalSpent'] || 0,
      transactions: 0, // Placeholder
      totalDeposit: this.userProfile()?.['totalDeposit'] || 0,
      totalTicket: 0, // Placeholder
      totalOrder: allOrders.length,
      pendingOrder: allOrders.filter(o => o.status === 'pending').length,
      processingOrder: allOrders.filter(o => o.status === 'processing').length,
      completedOrder: allOrders.filter(o => o.status === 'completed').length,
      refundOrder: allOrders.filter(o => o.status === 'refunded').length,
      cancelledOrder: allOrders.filter(o => o.status === 'cancelled').length,
      totalDripfeeds: 0 // Placeholder
    };
  });

  currentSection = signal<string>('overview');
  
  // Order Form
  categories = [
    { id: 'ig-shopify', name: 'Instagram to Shopify traffic USA' },
    { id: 'fb-shopify', name: 'Facebook to Shopify traffic USA' },
    { id: 'pin-shopify', name: 'Pinterest to Shopify traffic USA' },
    { id: 'yt-shopify', name: 'YouTube to Shopify traffic USA' },
    { id: 'tt-shopify', name: 'Tiktok to Shopify traffic USA' },
    { id: 'google-shopify', name: 'Google to Shopify traffic USA' }
  ];
  
  services: Record<string, { id: string, name: string, rate: number }[]> = {
    'ig-shopify': [{ id: 'ig1', name: 'Instagram Traffic', rate: 13.56 }],
    'fb-shopify': [{ id: 'fb1', name: 'Facebook Traffic', rate: 13.56 }],
    'pin-shopify': [{ id: 'pin1', name: 'Pinterest Traffic', rate: 13.56 }],
    'yt-shopify': [{ id: 'yt1', name: 'YouTube Traffic', rate: 13.56 }],
    'tt-shopify': [{ id: 'tt1', name: 'Tiktok Traffic', rate: 13.56 }],
    'google-shopify': [{ id: 'g1', name: 'Google Traffic', rate: 13.56 }]
  };

  selectedCategory = '';
  selectedService: { id: string, name: string, rate: number } | null = null;
  orderLink = '';
  orderQuantity = 500;
  totalCharge = 0;
  
  // Deposit
  depositAmount = 10;
  transactionId = '';
  isDepositing = signal(false);
  
  // Support
  ticketSubject = '';
  ticketMessage = '';
  isSubmittingTicket = signal(false);
  
  isPlacingOrder = signal(false);
  orderMessage = signal<{ type: 'success' | 'error', text: string } | null>(null);

  private unsubscribeAuth: (() => void) | null = null;
  private unsubscribeOrders: (() => void) | null = null;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['error'] === 'access-denied') {
        this.orderMessage.set({ type: 'error', text: 'Access Denied: You do not have permission to access the Admin Panel.' });
      }
    });

    this.unsubscribeAuth = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        this.isAdmin.set(user.email === 'info.kitgizmo@gmail.com');
        
        // Real-time user profile
        onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            this.userProfile.set(docSnap.data() as Record<string, unknown>);
          }
        });

        // Real-time orders
        const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
        this.unsubscribeOrders = onSnapshot(q, (snapshot) => {
          const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
          this.orders.set(ordersData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
          this.updateChart();
        });
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  ngAfterViewInit() {
    this.updateChart();
  }

  ngOnDestroy() {
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    if (this.unsubscribeOrders) this.unsubscribeOrders();
  }

  setSection(section: string) {
    this.currentSection.set(section);
    this.isSidebarOpen.set(false);
    if (section === 'overview') {
      setTimeout(() => this.updateChart(), 0);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  toggleSubMenu(menu: string) {
    this.expandedMenus.update(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  }

  onCategoryChange() {
    this.selectedService = null;
    this.calculateCharge();
  }

  calculateCharge() {
    if (this.selectedService && this.orderQuantity) {
      this.totalCharge = (this.selectedService.rate / 1000) * this.orderQuantity;
    } else {
      this.totalCharge = 0;
    }
  }

  async placeOrder() {
    const user = auth.currentUser;
    if (!user || !this.selectedService || !this.orderLink || this.orderQuantity < 500) return;

    const balance = (this.userProfile()?.['balance'] as number) || 0;
    if (balance < this.totalCharge) {
      this.orderMessage.set({ type: 'error', text: 'Insufficient balance. Please add funds.' });
      return;
    }

    this.isPlacingOrder.set(true);
    this.orderMessage.set(null);

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error("User does not exist!");
        
        const currentBalance = (userSnap.data()['balance'] as number) || 0;
        const currentSpent = (userSnap.data()['totalSpent'] as number) || 0;

        if (currentBalance < this.totalCharge) throw new Error("Insufficient balance!");

        // Create Order
        const orderRef = doc(collection(db, 'orders'));
        const orderData = {
          id: orderRef.id,
          userId: user.uid,
          userEmail: user.email,
          category: this.selectedCategory,
          service: this.selectedService?.name,
          link: this.orderLink,
          quantity: this.orderQuantity,
          charge: this.totalCharge,
          status: 'pending',
          createdAt: serverTimestamp()
        };

        transaction.set(orderRef, orderData);
        
        // Update User Balance
        transaction.update(userRef, {
          balance: currentBalance - this.totalCharge,
          totalSpent: currentSpent + this.totalCharge
        });
      });

      this.orderMessage.set({ type: 'success', text: 'Order placed successfully!' });
      this.resetForm();
    } catch (error: unknown) {
      console.error('Order error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to place order.';
      this.orderMessage.set({ type: 'error', text: msg });
    } finally {
      this.isPlacingOrder.set(false);
    }
  }

  private resetForm() {
    this.selectedCategory = '';
    this.selectedService = null;
    this.orderLink = '';
    this.orderQuantity = 500;
    this.totalCharge = 0;
  }

  async deposit() {
    const user = auth.currentUser;
    if (!user || this.depositAmount <= 0 || !this.transactionId) return;

    this.isDepositing.set(true);
    try {
      const depositRef = doc(collection(db, 'deposits'));
      const depositData = {
        id: depositRef.id,
        userId: user.uid,
        userEmail: user.email,
        amount: this.depositAmount,
        transactionId: this.transactionId,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      await runTransaction(db, async (transaction) => {
        transaction.set(depositRef, depositData);
      });
      
      this.orderMessage.set({ type: 'success', text: `Deposit request for $${this.depositAmount.toFixed(2)} submitted! Admin will review it soon.` });
      this.depositAmount = 10;
      this.transactionId = '';
    } catch (error) {
      console.error('Deposit error:', error);
      this.orderMessage.set({ type: 'error', text: 'Failed to submit deposit request.' });
    } finally {
      this.isDepositing.set(false);
    }
  }

  async submitTicket() {
    const user = auth.currentUser;
    if (!user || !this.ticketSubject || !this.ticketMessage) return;

    this.isSubmittingTicket.set(true);
    try {
      const ticketRef = doc(collection(db, 'tickets'));
      const ticketData = {
        id: ticketRef.id,
        userId: user.uid,
        userEmail: user.email,
        subject: this.ticketSubject,
        message: this.ticketMessage,
        status: 'open',
        replies: [],
        createdAt: serverTimestamp()
      };
      
      await runTransaction(db, async (transaction) => {
        transaction.set(ticketRef, ticketData);
      });
      
      this.orderMessage.set({ type: 'success', text: 'Support ticket submitted successfully!' });
      this.ticketSubject = '';
      this.ticketMessage = '';
    } catch (error) {
      console.error('Ticket error:', error);
      this.orderMessage.set({ type: 'error', text: 'Failed to submit support ticket.' });
    } finally {
      this.isSubmittingTicket.set(false);
    }
  }

  private updateChart() {
    if (!this.chartContainer) return;
    
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();

    const data = this.getChartData();
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = element.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 10])
      .range([height, 0]);

    const area = d3.area<{ date: Date, count: number }>()
      .x(d => x(d.date))
      .y0(height)
      .y1(d => y(d.count))
      .curve(d3.curveMonotoneX);

    const line = d3.line<{ date: Date, count: number }>()
      .x(d => x(d.date))
      .y(d => y(d.count))
      .curve(d3.curveMonotoneX);

    // Gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#38BDF8').attr('stop-opacity', 0.3);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#38BDF8').attr('stop-opacity', 0);

    svg.append('path')
      .datum(data)
      .attr('fill', 'url(#area-gradient)')
      .attr('d', area);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#38BDF8')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.timeFormat('%b %d') as (d: Date | d3.NumberValue, i: number) => string))
      .attr('color', '#475569');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .attr('color', '#475569');
  }

  private getChartData() {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).reverse();

    const orderCounts = last7Days.map(date => {
      const count = this.orders().filter(o => {
        const orderDate = o.createdAt?.toDate();
        return orderDate && 
               orderDate.getFullYear() === date.getFullYear() &&
               orderDate.getMonth() === date.getMonth() &&
               orderDate.getDate() === date.getDate();
      }).length;
      return { date, count };
    });

    return orderCounts;
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
