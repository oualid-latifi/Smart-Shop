package smartshop.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Partial merchandise-return endpoints are intentionally retired.
 * Existing refund records remain in the database for historical reporting.
 * Full sale cancellation is handled by SaleController.
 */
@RestController
@RequestMapping("/api/sales")
public class SaleRefundController {
}
