import { createRouter, createWebHistory } from 'vue-router';
import Home from '@/views/Home.vue';
import Signup from '@/views/Signup.vue';
import Signin from '@/views/Signin.vue';
import EventDetail from '@/views/EventDetail.vue';
import EventList from '../components/EventList.vue';
import TicketSelectionView from '@/views/TicketSelection.vue';
import AdminDashboard from '@/views/AdminDashboard.vue';
import OrganizerDashboard from '@/views/OrganizerDashboard.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/signup', component: Signup },
  { path: '/signin', component: Signin },
  { path: '/events', name: 'events', component: EventList },
  {
    path: '/events/:id',
    name: 'event-detail',
    component: EventDetail,
    props: true,
  },
  {
    path: '/events/:id/tickets',
    name: 'event-tickets',
    component: TicketSelectionView,
    props: (route) => ({
      id: String(route.params.id),
      qty: Number(route.query.qty || 1),
    }),
  },
  {
    path: '/payment/:id',
    name: 'payment',
    component: () => import('@/components/PaymentForm.vue'),
    props: (route) => ({
      id: String(route.params.id),
      initialQty: Number(route.query.qty || 1),
    }),
  },
  {
    path: '/payment/success',
    name: 'payment-success',
    component: () => import('@/views/PaymentSuccess.vue'),
  },
  {
    path: '/customer-infos/:id',
    name: 'customer-infos',
    component: () => import('@/components/CustomerInfos.vue'),
  },
  {
    path: '/dashboard/admin',
    name: 'admin-dashboard',
    component: AdminDashboard,
  },
  {
    path: '/dashboard/organizer',
    name: 'organizer-dashboard',
    component: OrganizerDashboard,
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/Profile.vue'),
  },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
