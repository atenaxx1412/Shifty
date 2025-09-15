#!/usr/bin/env tsx

/**
 * Firestore Indexes Creation Script
 * 
 * このスクリプトは必要なFirestoreインデックスの作成方法を案内します
 */

console.log('🔥 Firestore Indexes Creation Guide');
console.log('=====================================');

const indexes = [
  {
    collection: 'shifts',
    fields: ['shopId', 'date', '__name__'],
    url: 'https://console.firebase.google.com/v1/r/project/shifty-dc8fb/firestore/indexes?create_composite=Cktwcm9qZWN0cy9zaGlmdHktZGM4ZmIvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3NoaWZ0cy9pbmRleGVzL18QARoKCgZzaG9wSWQQARoICgRkYXRlEAEaDAoIX19uYW1lX18QAQ',
    purpose: 'StatsService - Weekly shifts query'
  },
  {
    collection: 'budget_calculations',
    fields: ['shopId', 'createdAt', 'period.end', 'period.start', '__name__'],
    url: 'https://console.firebase.google.com/v1/r/project/shifty-dc8fb/firestore/indexes?create_composite=Clhwcm9qZWN0cy9zaGlmdHktZGM4ZmIvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2J1ZGdldF9jYWxjdWxhdGlvbnMvaW5kZXhlcy9fEAEaCgoGc2hvcElkEAEaDQoJY3JlYXRlZEF0EAIaDgoKcGVyaW9kLmVuZBACGhAKDHBlcmlvZC5zdGFydBACGgwKCF9fbmFtZV9fEAI',
    purpose: 'StatsService - Monthly budget query'
  },
  {
    collection: 'shift_requests_enhanced',
    fields: ['userId', 'createdAt', '__name__'],
    url: 'https://console.firebase.google.com/v1/r/project/shifty-dc8fb/firestore/indexes?create_composite=Clxwcm9qZWN0cy9zaGlmdHktZGM4ZmIvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3NoaWZ0X3JlcXVlc3RzX2VuaGFuY2VkL2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI',
    purpose: 'ShiftService - User shift requests query (userId + createdAt DESC)'
  }
];

console.log('\n📋 Required Indexes:');
console.log('===================');

indexes.forEach((index, i) => {
  console.log(`\n${i + 1}. ${index.collection} Collection`);
  console.log(`   Fields: ${index.fields.join(' → ')}`);
  console.log(`   Purpose: ${index.purpose}`);
  console.log(`   URL: ${index.url}`);
});

console.log('\n🚀 Instructions:');
console.log('================');
console.log('1. Click each URL above');
console.log('2. Login to Firebase Console');
console.log('3. Click "Create Index" button');
console.log('4. Wait for index creation (5-10 minutes)');
console.log('5. Refresh your app to test');

console.log('\n⚡ Quick Links:');
console.log('==============');
console.log('Firebase Console: https://console.firebase.google.com/project/shifty-dc8fb/firestore');
console.log('Index Status: https://console.firebase.google.com/project/shifty-dc8fb/firestore/indexes');

export {};