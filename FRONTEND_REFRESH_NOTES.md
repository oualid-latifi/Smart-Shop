# SmartShop — Frontend refresh and feature updates

## Interface updates
- Refreshed bottom navigation icons and labels for the main shop sections.
- Improved the dashboard, Purchases, Reports, Products and Customers screens.
- Added clearer product and customer list rows, summary cards, search areas and actions.
- Improved the shared button and form-field styling.

## New features in this version
- Sales screen now shows the product catalogue immediately in a shuffled order when opened/refreshed.
- Product search filters the visible catalogue by product name, reference, brand or model.
- Tapping a product card adds it to the cart; out-of-stock products are disabled.
- Cart quantity cannot be increased beyond the available stock.
- Product records now support optional brand, model, color, capacity/storage and image URL fields.
- Product list and sales cards display a remote image when an image URL is provided.
- Customer detail now shows sales history, purchased product names, amounts paid and remaining balances.
- Backend report export endpoints now generate PDF and Excel (.xlsx) files for a selected date range.

## Existing behavior preserved
- Barcode/scanner remains removed from the mobile source and dependencies.
- Owner-only account model remains unchanged.
- Customer credit/debt and supplier payment flows remain in place.
- Existing stock, purchase and sales flows remain in place.
- No warranty-management module was added.

## New backend routes
- `GET /api/customers/{id}/sales`
- `GET /api/reports/export/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/reports/export/excel?from=YYYY-MM-DD&to=YYYY-MM-DD`

The export endpoints use the existing authenticated API security. They can be tested with Postman using the normal Bearer token. Dates are optional; when omitted, the report defaults to the current month through today.

## Validation and limitations
- French and Arabic translation JSON files were parsed successfully.
- No Barcode, Scanner or expo-camera references remain in the mobile source/package manifest.
- TypeScript parsing was attempted, but a full typecheck could not be completed because node dependencies are not installed in this preparation environment.
- Maven is not installed in this environment, so the Spring Boot backend was not compiled or integration-tested here.
- Before production use, run `npm ci` and `npx tsc --noEmit` in `smartshop-mobile`, then `mvn test` in `back-end`. Test PDF/XLSX downloads and the new customer history route with a local database.
