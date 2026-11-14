package smartshop.exception;

/** L'opération demande le code PIN du propriétaire : renvoyée en 403 avec le code "APPROVAL_REQUIRED". */
public class ApprovalRequiredException extends RuntimeException {

    public ApprovalRequiredException(String message) {
        super(message);
    }
}
