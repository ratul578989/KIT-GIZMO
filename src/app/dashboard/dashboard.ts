import { Component, inject, signal, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { auth, db } from '../../firebase';
import { signOut, onAuthStateChanged, User, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, collection, query, where, onSnapshot, serverTimestamp, runTransaction, Timestamp, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import * as d3 from 'd3';

interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  imageUrl?: string;
  status: string;
  replies: { sender: string, message: string, imageUrl?: string, timestamp: Timestamp }[];
  createdAt: Timestamp | null;
}

interface Order {
  id: string;
  userId: string;
  category: string;
  service: string;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  startCount?: number;
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

interface Deposit {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  methodName: string;
  transactionId: string;
  status: string;
  createdAt: Timestamp | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  address: string;
  instructions: string;
  isActive: boolean;
  createdAt: Timestamp | null;
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
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin-slow {
      animation: spin-slow 8s linear infinite;
    }
    @keyframes progress-bar {
      0% { width: 0%; }
      100% { width: 100%; }
    }
    .animate-progress-bar {
      animation: progress-bar 7s linear forwards;
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  userProfile = signal<UserProfile | null>(null);
  orders = signal<Order[]>([]);
  deposits = signal<Deposit[]>([]);
  paymentMethods = signal<PaymentMethod[]>([]);
  
  isSidebarOpen = signal(false);
  isAdmin = signal(false);
  expandedMenus = signal<Record<string, boolean>>({
    'orders': false,
    'deposit': false,
    'profile': false
  });

  stats = computed(() => {
    const allOrders = this.orders();
    const allDeposits = this.deposits();
    return {
      balance: this.userProfile()?.['balance'] || 0,
      totalSpent: this.userProfile()?.['totalSpent'] || 0,
      transactions: allOrders.length + allDeposits.length,
      totalDeposit: allDeposits.filter(d => d.status === 'approved').reduce((acc, d) => acc + d.amount, 0),
      totalTicket: this.tickets().length,
      totalOrder: allOrders.length,
      pendingOrder: allOrders.filter(o => o.status === 'pending').length,
      processingOrder: allOrders.filter(o => o.status === 'processing').length,
      completedOrder: allOrders.filter(o => o.status === 'completed').length,
      refundOrder: allOrders.filter(o => o.status === 'refunded').length,
      cancelledOrder: allOrders.filter(o => o.status === 'cancelled').length,
      totalDripfeeds: 0
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
  selectedMethodId = '';
  selectedMethod = signal<PaymentMethod | null>(null);
  isDepositing = signal(false);
  showDepositSuccess = signal(false);
  addressCopied = signal(false);
  
  // Password
  passwordForm = { current: '', new: '', confirm: '' };
  passwordError = signal<string | null>(null);
  passwordSuccess = signal<string | null>(null);

  onTicketFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        this.orderMessage.set({ type: 'error', text: 'Maximum file size: 10MB' });
        return;
      }
      this.selectedTicketFile.set(file);
      this.filePreview.set(URL.createObjectURL(file));
    }
  }

  async changePassword() {
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    if (this.passwordForm.new !== this.passwordForm.confirm) {
      this.passwordError.set('Passwords do not match');
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;
      const cred = EmailAuthProvider.credential(user.email, this.passwordForm.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, this.passwordForm.new);
      this.passwordSuccess.set('Password updated successfully!');
      this.passwordForm = { current: '', new: '', confirm: '' };
    } catch {
      this.passwordError.set('Incorrect Current Password');
    }
  }
  
  // Support
  ticketSubject = '';
  ticketMessage = '';
  isSubmittingTicket = signal(false);
  selectedTicketFile = signal<File | null>(null);
  filePreview = signal<string | null>(null);
  tickets = signal<Ticket[]>([]);
  selectedTicket = signal<Ticket | null>(null);
  replyMessage = signal('');
  isReplying = signal(false);
  selectedImage = signal<string | null>(null);
  
  isPlacingOrder = signal(false);
  orderMessage = signal<{ type: 'success' | 'error', text: string } | null>(null);

  orderSearchTerm = signal('');
  orderStatusFilter = signal('all');
  
  // Time Selector
  isTimeSelectorOpen = signal(false);
  timeRange = signal('30d');
  timeRangeLabel = computed(() => {
    switch(this.timeRange()) {
      case '7d': return 'Last 7 days';
      case '90d': return 'Last 90 days';
      default: return 'Last 30 days';
    }
  });

  toggleTimeSelector() { this.isTimeSelectorOpen.update(v => !v); }
  setTimeRange(range: string) { 
    this.timeRange.set(range); 
    this.isTimeSelectorOpen.set(false);
    this.updateChart();
  }

  filteredOrders = computed(() => {
    const term = this.orderSearchTerm().toLowerCase();
    const filter = this.orderStatusFilter();
    
    return this.orders().filter(order => {
      const matchesSearch = order.id.toLowerCase().includes(term) || 
                           order.service.toLowerCase().includes(term) ||
                           order.link.toLowerCase().includes(term);
      const matchesFilter = filter === 'all' || order.status === filter;
      return matchesSearch && matchesFilter;
    });
  });

  transactions = computed(() => {
    const orders = this.orders().map(o => ({
      id: o.id,
      date: o.createdAt,
      type: 'Order Placement',
      amount: -o.charge,
      method: 'N/A',
      status: o.status
    }));
    const deposits = this.deposits().map(d => ({
      id: d.id,
      date: d.createdAt,
      type: 'Deposit',
      amount: d.amount,
      method: d.methodName,
      status: d.status
    }));
    return [...orders, ...deposits].sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));
  });

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

        // Real-time deposits
        const depQ = query(collection(db, 'deposits'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
        onSnapshot(depQ, (snapshot) => {
          this.deposits.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deposit)));
        });

        // Real-time tickets
        const ticketsQ = query(collection(db, 'tickets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
        onSnapshot(ticketsQ, (snapshot) => {
          this.tickets.set(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket)));
        });

        // Track Activity
        this.trackActivity(user.uid);
      } else {
        this.router.navigate(['/login']);
      }
    });

    // Real-time Payment Methods (Active only)
    const methodsQ = query(collection(db, 'paymentMethods'), where('isActive', '==', true));
    onSnapshot(methodsQ, (snap) => {
      this.paymentMethods.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
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

  private async trackActivity(uid: string) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        lastActive: serverTimestamp()
      });
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  }

  onMethodChange() {
    const method = this.paymentMethods().find(m => m.id === this.selectedMethodId);
    this.selectedMethod.set(method || null);
  }

  copyAddress(address: string) {
    navigator.clipboard.writeText(address);
    this.addressCopied.set(true);
    setTimeout(() => this.addressCopied.set(false), 2000);
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
          startCount: 0,
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
    const method = this.selectedMethod();
    if (!user || !method || this.depositAmount <= 0 || !this.transactionId) return;

    this.isDepositing.set(true);
    try {
      const depositRef = doc(collection(db, 'deposits'));
      const depositData = {
        id: depositRef.id,
        userId: user.uid,
        userEmail: user.email,
        amount: this.depositAmount,
        methodName: method.name,
        transactionId: this.transactionId,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      await runTransaction(db, async (transaction) => {
        transaction.set(depositRef, depositData);
      });
      
      this.showDepositSuccess.set(true);
      this.depositAmount = 10;
      this.transactionId = '';
      this.selectedMethodId = '';
      this.selectedMethod.set(null);

      // Redirect after 7 seconds
      setTimeout(() => {
        if (this.currentSection() === 'add-funds') {
          this.showDepositSuccess.set(false);
          this.setSection('deposit-log');
        }
      }, 7000);

    } catch (error) {
      console.error('Deposit error:', error);
      this.orderMessage.set({ type: 'error', text: 'Failed to submit deposit request.' });
    } finally {
      this.isDepositing.set(false);
    }
  }

  async uploadImage(file: File): Promise<string> {
    const storageRef = ref(storage, `tickets/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  }

  async submitTicket() {
    const user = auth.currentUser;
    if (!user || !this.ticketSubject || !this.ticketMessage) return;

    this.isSubmittingTicket.set(true);
    try {
      let imageUrl = '';
      if (this.selectedTicketFile()) {
        imageUrl = await this.uploadImage(this.selectedTicketFile()!);
      }

      const ticketRef = doc(collection(db, 'tickets'));
      const ticketData = {
        id: ticketRef.id,
        userId: user.uid,
        userEmail: user.email,
        subject: this.ticketSubject,
        message: this.ticketMessage,
        imageUrl: imageUrl || null,
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
      this.selectedTicketFile.set(null);
      this.filePreview.set(null);
    } catch (error) {
      console.error('Ticket error:', error);
      this.orderMessage.set({ type: 'error', text: 'Failed to submit support ticket.' });
    } finally {
      this.isSubmittingTicket.set(false);
    }
  }

  async replyToTicket(ticketId: string) {
    const user = auth.currentUser;
    if (!user || !this.replyMessage().trim()) return;

    this.isReplying.set(true);
    try {
      let imageUrl = '';
      if (this.selectedTicketFile()) {
        imageUrl = await this.uploadImage(this.selectedTicketFile()!);
      }

      const ticketRef = doc(db, 'tickets', ticketId);
      const reply = {
        sender: 'user',
        message: this.replyMessage().trim(),
        imageUrl: imageUrl || null,
        timestamp: Timestamp.now()
      };

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ticketRef);
        const replies = snap.data()?.['replies'] || [];
        transaction.update(ticketRef, {
          replies: [...replies, reply]
        });
      });

      this.replyMessage.set('');
      this.selectedTicketFile.set(null);
      this.filePreview.set(null);
    } catch (error) {
      console.error('Reply error:', error);
    } finally {
      this.isReplying.set(false);
    }
  }

  private updateChart() {
    if (!this.chartContainer) return;
    
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();

    const data = this.getSpentChartData();
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
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
      .domain([0, d3.max(data, d => d.spent) || 10])
      .range([height, 0]);

    const area = d3.area<{ date: Date, spent: number }>()
      .x(d => x(d.date))
      .y0(height)
      .y1(d => y(d.spent))
      .curve(d3.curveMonotoneX);

    const line = d3.line<{ date: Date, spent: number }>()
      .x(d => x(d.date))
      .y(d => y(d.spent))
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

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .attr('color', '#475569');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${(d.valueOf()).toFixed(2)}`))
      .attr('color', '#475569');
  }

  private getSpentChartData() {
    const rangeDays = this.timeRange() === '7d' ? 7 : this.timeRange() === '90d' ? 90 : 30;
    const days = Array.from({ length: rangeDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).reverse();

    return days.map(date => {
      const spent = this.orders().filter(o => {
        const orderDate = o.createdAt?.toDate();
        return orderDate && 
               orderDate.getFullYear() === date.getFullYear() &&
               orderDate.getMonth() === date.getMonth() &&
               orderDate.getDate() === date.getDate();
      }).reduce((acc, o) => acc + (o.charge || 0), 0);
      return { date, spent };
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
