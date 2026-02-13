import { test, expect } from 'playwright-test-coverage';
import type { Page, Route } from '@playwright/test';

enum Role {
  Diner = 'diner',
  Admin = 'admin',
}

type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  roles: { role: Role }[];
};

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;

  const validUsers: Record<string, User> = {
    'd@jwt.com': { id: '3', name: 'KC', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
    'admin@jwt.com': { id: '1', name: 'Admin', email: 'admin@jwt.com', password: 'a', roles: [{ role: Role.Admin }] },
  };

  // Auth route
  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ status: 200 });
      return;
    }

    if (method !== 'PUT') {
      await route.fulfill({ status: 400 });
      return;
    }

    const loginReq = route.request().postDataJSON();

    if (!loginReq) {
      await route.fulfill({ status: 400 });
      return;
    }

    const user = validUsers[loginReq.email];

    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }

    loggedInUser = user;

    await route.fulfill({
      json: { user: loggedInUser, token: 'abcdef' },
    });
  });

  // /api/user/me
  await page.route('*/**/api/user/me', async (route) => {
    if (!loggedInUser) {
      await route.fulfill({ status: 401, json: { error: 'Not logged in' } });
      return;
    }
    await route.fulfill({ json: loggedInUser });
  });

  // Menu
  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({
      json: [
        { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
        { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
      ],
    });
  });

  // Franchises
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        franchises: [
          { id: 2, name: 'LotaPizza', stores: [{ id: 4, name: 'Lehi' }, { id: 5, name: 'Springville' }, { id: 6, name: 'American Fork' }] },
          { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
          { id: 4, name: 'topSpot', stores: [] },
        ],
      },
    });
  });

  // Order
  await page.route('*/**/api/order', async (route) => {
    const orderReq = route.request().postDataJSON();
    await route.fulfill({ json: { order: { ...orderReq, id: 23 }, jwt: 'eyJpYXQ' } });
  });

  await page.goto('/');
}

// ------------------------
// TESTS
// ------------------------

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('JWT Pizza');
});



test('login as admin shows Admin', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('admin@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible({ timeout: 10000 });
});

test('purchase flow with login', async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();
});

test('logout clears user', async ({ page }) => {
  await basicInit(page);
  await page.goto('/logout');
  await expect(page.getByRole('main')).toBeVisible();

  // Try fetching user
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible({ timeout: 5000 });
});

test('about page loads', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('main')).toBeVisible();
});

test('docs page loads', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByRole('main')).toBeVisible();
});

test('register page loads', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading')).toBeVisible();
});

test('not found page renders', async ({ page }) => {
  await page.goto('/thispagedoesnotexist');
  await expect(page.getByRole('main')).toBeVisible();
});

test('history page loads after login', async ({ page }) => {
  await basicInit(page);
  await page.goto('/history');
  await expect(page.getByRole('main')).toBeVisible();
});

test('diner dashboard loads after login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('/diner');
  await expect(page.getByRole('main')).toBeVisible();
});

export { basicInit };