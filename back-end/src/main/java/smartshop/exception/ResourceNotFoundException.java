package smartshop.exception;

/** Ressource demandée inexistante : renvoyée en 404. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
