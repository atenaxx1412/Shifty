import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/'];
  
  // Protected routes that require authentication
  const protectedRoutes = ['/root', '/manager', '/staff'];
  
  // Check if the path is a public route
  const isPublicRoute = publicRoutes.some(route => path === route);
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  
  // Get authentication cookie (this will be set after Firebase auth)
  const token = request.cookies.get('auth-token');
  
  // Redirect to login if not authenticated and trying to access protected route
  if ((isProtectedRoute || !isPublicRoute) && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Allow authenticated users to access their designated pages
  // Role-based routing is handled by AuthContext after login
  
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