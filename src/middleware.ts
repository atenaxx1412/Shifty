import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/'];
  
  // Check if the path is a public route
  const isPublicRoute = publicRoutes.some(route => path === route);
  
  // Get authentication cookie (this will be set after Firebase auth)
  const token = request.cookies.get('auth-token');
  
  // Redirect to login if not authenticated and trying to access protected route
  if (!isPublicRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Redirect to dashboard if authenticated and trying to access login
  if (isPublicRoute && token && path !== '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
};