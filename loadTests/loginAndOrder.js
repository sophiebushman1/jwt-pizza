import { sleep, check, group, fail } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const vars = {};

  // ── 1. Login ─────────────────────────────────────────────────────────────
  group('Login', () => {
    const response = http.put(
      'https://pizza-service.sophiebyu.click/api/auth',
      JSON.stringify({ email: 'a@jwt.com', password: 'admin' }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (
      !check(response, {
        'login status 200': (r) => r.status === 200,
      })
    ) {
      console.log(response.body);
      fail('Login was not 200');
    }

    vars.authToken = response.json('token');
  });

  sleep(1);

  // ── 2. Get menu ──────────────────────────────────────────────────────────
  group('Get menu', () => {
    const response = http.get('https://pizza-service.sophiebyu.click/api/order/menu', {
      headers: {
        Authorization: `Bearer ${vars.authToken}`,
      },
    });

    if (
      !check(response, {
        'menu status 200': (r) => r.status === 200,
      })
    ) {
      fail('Get menu was not 200');
    }

    const menu = response.json();
    vars.menuItem = menu[0] || { id: 1, description: 'Veggie', price: 0.0038 };
  });

  sleep(1);

  // ── 3. Get franchises ────────────────────────────────────────────────────
  group('Get franchises', () => {
    const response = http.get('https://pizza-service.sophiebyu.click/api/franchise', {
      headers: {
        Authorization: `Bearer ${vars.authToken}`,
      },
    });

    check(response, { 'franchise status 200': (r) => r.status === 200 });

    const franchises = response.json();
    vars.franchiseId = franchises[0]?.id || 1;
    vars.storeId = franchises[0]?.stores?.[0]?.id || 1;
  });

  sleep(1);

  // ── 4. Order pizza ───────────────────────────────────────────────────────
  group('Order pizza', () => {
    const response = http.post(
      'https://pizza-service.sophiebyu.click/api/order',
      JSON.stringify({
        franchiseId: vars.franchiseId,
        storeId: vars.storeId,
        items: [
          {
            menuId: vars.menuItem.id,
            description: vars.menuItem.description,
            price: vars.menuItem.price,
          },
        ],
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vars.authToken}`,
        },
      }
    );

    if (
      !check(response, {
        'order status 200': (r) => r.status === 200,
      })
    ) {
      console.log(response.body);
      fail('Order was not 200');
    }

    // Read pizza JWT from response (not hard-coded)
    vars.pizzaJwt = response.json('jwt');
  });

  sleep(1);

  // ── 5. Verify pizza JWT ──────────────────────────────────────────────────
  group('Verify pizza', () => {
    const response = http.post(
      'https://pizza-factory.cs329.click/api/order/verify',
      JSON.stringify({ jwt: vars.pizzaJwt }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${vars.authToken}`,
        },
      }
    );

    check(response, { 'verify status 200': (r) => r.status === 200 });
  });

  sleep(1);
}
