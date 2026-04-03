# Curiosity Report: OpenTelemetry & Distributed Tracing

## Why I Got Curious

While working on jwt-pizza, we mostly used metrics (Prometheus and Grafana) to track things like errors and request counts. That's helpful, but when something actually breaks, it doesn't tell you where it broke or why — which is frustrating. For example, if a pizza order fails, I couldn't tell if it was JWT auth, the database, or the pizza factory call. That made me look into a solution like distributed tracing, which is basically a way to follow one request all the way through the system — which is when I found OpenTelemetry.

## Where This Comes From (Dapper)

Distributed tracing primarily started with Google's Dapper paper (2010). The idea is pretty simple:

- A **trace** = one request
- A **span** = one step in that request (like a DB call or API call)

Each request builds a tree of spans so you can see exactly what happened and how long each step took. The tricky part is passing that trace info between services. Dapper solved it by adding trace data into request headers so every service can keep the trace connected and going.

## OpenTelemetry (OTel)

After Dapper, a bunch of tools came out (Zipkin, Jaeger, etc.), but they didn't all work well together. So in 2019, OpenTelemetry was created to standardize everything.

It basically gives you:

- **Traces** (request flow)
- **Metrics** (numbers over time)
- **Logs**

The key idea is **context propagation** — passing a trace ID through requests using headers (like `traceparent`) so all services stay connected in one string.

## How It Works

1. Each request gets a trace ID
2. Each step is a span
3. Spans are linked together (parent/child)
4. Everything gets sent to a backend (like Jaeger) to visualize

There's also an **OpenTelemetry Collector**, which acts like a middleman so your app doesn't talk directly to the backend.

## My Experiment with jwt-pizza

I added OpenTelemetry to the backend and hooked it up to Jaeger locally. Honestly, setup was pretty easy — mostly just installing packages and enabling auto-instrumentation.

The cool part is that it automatically tracked things like:

- API routes
- Database queries
- Outgoing HTTP calls

When I ran it, each pizza order showed up as a trace with a breakdown like:

```
API request
  ├── DB queries
  ├── HTTP call to pizza factory
  └── insert order
```

Right away I could see the pizza factory call was the slowest part — something metrics didn't show.

## Why This Matters

- **Debugging is way easier** — you can see exactly where a request failed
- **Faster fixes (MTTR)** — no guessing or digging through logs
- **Better than just metrics** — metrics tell you something is wrong, tracing tells you what and where

It also would've made the chaos testing assignment way easier since you could see the exact failing request.

## Takeaway

Metrics tell you that something broke, but tracing takes you a step further by telling you why. Adding OpenTelemetry took less than an hour and gave way better visibility into what was happening inside requests. It's pretty much becoming the standard, so definitely useful to know about going into industry.

## References

- Sigelman et al., *"Dapper, a Large-Scale Distributed Systems Tracing Infrastructure"*, Google Technical Report, 2010: https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/
- OpenTelemetry CNCF Project: https://www.cncf.io/projects/opentelemetry/
- W3C Trace Context Specification: https://www.w3.org/TR/trace-context/
