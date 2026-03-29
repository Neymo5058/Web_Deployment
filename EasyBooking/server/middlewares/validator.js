const emailRegex = /.+@.+\..+/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_CURRENCY = 'CAD';

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;
const isPlainObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);

const buildError = (field, message) => ({ field, message });

const allowedRoles = ['user', 'organizer'];

const collectErrors = (validations) => {
  return validations.filter((validation) => validation !== null);
};

export const registerValidation = (req, _res, next) => {
  const { fullname, email, password, confirmPassword, role } = req.body || {};
  const errors = collectErrors([
    !fullname || fullname.trim().length < 3
      ? buildError('fullname', 'Full name must be at least 3 characters long')
      : null,
    !email || !emailRegex.test(email)
      ? buildError('email', 'A valid email address is required')
      : null,
    !password || password.length < 8
      ? buildError('password', 'Password must be at least 8 characters long')
      : null,
    password !== confirmPassword
      ? buildError('confirmPassword', 'Passwords do not match')
      : null,
    role && !allowedRoles.includes(role)
      ? buildError('role', 'Role must be user or organizer')
      : null,
  ]);

  req.validationErrors = errors;
  next();
};

export const loginValidation = (req, _res, next) => {
  const { email, password } = req.body || {};

  const errors = collectErrors([
    !email || !emailRegex.test(email)
      ? buildError('email', 'A valid email address is required')
      : null,
    !password ? buildError('password', 'Password is required') : null,
  ]);

  req.validationErrors = errors;
  next();
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return Number.NaN;
  const number = Number(value);
  return Number.isNaN(number) ? Number.NaN : number;
};

export const createEventValidation = (req, _res, next) => {
  const body = req.body || {};
  const {
    title,
    subtitle,
    imageUrl,
    startsAt,
    hour,
    place,
    organizer,
    price,
    currency,
    capacity,
    available,
  } = body;

  const errors = [];
  const sanitized = {};

  if (!isNonEmptyString(title) || title.trim().length < 3) {
    errors.push(
      buildError('title', 'Title must be at least 3 characters long')
    );
  } else {
    sanitized.title = title.trim();
  }

  if (subtitle !== undefined && subtitle !== null) {
    if (typeof subtitle !== 'string') {
      errors.push(buildError('subtitle', 'Subtitle must be a string value'));
    } else if (subtitle.trim().length > 0) {
      sanitized.subtitle = subtitle.trim();
    }
  }

  // ✅ Fix for imageUrl (absolute URLs or relative /img paths)
  if (!isNonEmptyString(imageUrl)) {
    errors.push(buildError('imageUrl', 'Image URL is required'));
  } else {
    const trimmedUrl = imageUrl.trim();

    if (trimmedUrl.startsWith('data:')) {
      sanitized.imageUrl = trimmedUrl;
    } else if (trimmedUrl.startsWith('/')) {
      sanitized.imageUrl = trimmedUrl;
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.push(
            buildError('imageUrl', 'Image URL must use http or https')
          );
        } else {
          sanitized.imageUrl = trimmedUrl;
        }
      } catch (_err) {
        errors.push(
          buildError(
            'imageUrl',
            'Image URL must be a valid URL or start with /'
          )
        );
      }
    }
  }

  const parsedDate = parseDate(startsAt);
  if (!parsedDate) {
    errors.push(buildError('startsAt', 'A valid start date is required'));
  } else {
    sanitized.startsAt = parsedDate;
  }

  if (!isNonEmptyString(hour) || !timeRegex.test(hour.trim())) {
    errors.push(buildError('hour', 'Hour must be provided in HH:MM format'));
  } else {
    sanitized.hour = hour.trim();
  }

  let placeValid = true;
  if (!isPlainObject(place)) {
    errors.push(buildError('place', 'Place information is required'));
    placeValid = false;
  }

  if (placeValid && !isNonEmptyString(place.name)) {
    errors.push(buildError('place.name', 'Place name is required'));
    placeValid = false;
  }

  if (placeValid && !isNonEmptyString(place.city)) {
    errors.push(buildError('place.city', 'Place city is required'));
    placeValid = false;
  }

  if (placeValid && place.country !== undefined && place.country !== null) {
    if (typeof place.country !== 'string') {
      errors.push(
        buildError('place.country', 'Place country must be a string value')
      );
      placeValid = false;
    }
  }

  if (placeValid && place) {
    const sanitizedPlace = {
      name: place.name.trim(),
      city: place.city.trim(),
    };

    if (typeof place.country === 'string' && place.country.trim().length > 0) {
      sanitizedPlace.country = place.country.trim();
    }

    sanitized.place = sanitizedPlace;
  }

  if (!isNonEmptyString(organizer) || organizer.trim().length < 2) {
    errors.push(
      buildError('organizer', 'Organizer must be at least 2 characters long')
    );
  } else {
    sanitized.organizer = organizer.trim();
  }

  const priceNumber = parseNumber(price);
  if (Number.isNaN(priceNumber)) {
    errors.push(buildError('price', 'Price must be a numeric value'));
  } else if (priceNumber < 0) {
    errors.push(buildError('price', 'Price cannot be negative'));
  } else {
    sanitized.price = priceNumber;
  }

  const capacityNumber = parseNumber(capacity);
  if (Number.isNaN(capacityNumber)) {
    errors.push(
      buildError('capacity', 'Capacity must be provided as a number')
    );
  } else if (!Number.isInteger(capacityNumber)) {
    errors.push(buildError('capacity', 'Capacity must be an integer'));
  } else if (capacityNumber < 1) {
    errors.push(buildError('capacity', 'Capacity must be at least 1'));
  } else {
    sanitized.capacity = capacityNumber;
  }

  const hasAvailable =
    available !== undefined && available !== null && available !== '';
  let availableNumber;
  if (hasAvailable) {
    availableNumber = parseNumber(available);
    if (Number.isNaN(availableNumber)) {
      errors.push(buildError('available', 'Available spots must be a number'));
      availableNumber = undefined;
    } else if (!Number.isInteger(availableNumber)) {
      errors.push(
        buildError('available', 'Available spots must be an integer')
      );
      availableNumber = undefined;
    } else if (availableNumber < 0) {
      errors.push(
        buildError('available', 'Available spots cannot be negative')
      );
      availableNumber = undefined;
    }
  }

  if (
    !hasAvailable &&
    Number.isInteger(capacityNumber) &&
    capacityNumber >= 1
  ) {
    availableNumber = capacityNumber;
  }

  if (
    typeof availableNumber === 'number' &&
    typeof capacityNumber === 'number' &&
    !Number.isNaN(availableNumber) &&
    !Number.isNaN(capacityNumber) &&
    availableNumber > capacityNumber
  ) {
    errors.push(
      buildError('available', 'Available spots cannot exceed capacity')
    );
  }

  if (typeof availableNumber === 'number' && !Number.isNaN(availableNumber)) {
    sanitized.available = availableNumber;
  }

  if (currency === undefined || currency === null || currency === '') {
    sanitized.currency = DEFAULT_CURRENCY;
  } else if (typeof currency !== 'string') {
    errors.push(buildError('currency', 'Currency must be a string value'));
  } else {
    const trimmedCurrency = currency.trim().toUpperCase();
    if (trimmedCurrency !== DEFAULT_CURRENCY) {
      errors.push(buildError('currency', 'Currency must be CAD'));
    } else {
      sanitized.currency = DEFAULT_CURRENCY;
    }
  }

  req.validationErrors = errors;
  if (errors.length === 0) {
    req.validatedEvent = sanitized;
  } else {
    delete req.validatedEvent;
  }

  next();
};

export const validateRequest = (req, res, next) => {
  if (req.validationErrors && req.validationErrors.length > 0) {
    return res.status(400).json({ errors: req.validationErrors });
  }

  return next();
};

export default {
  registerValidation,
  loginValidation,
  createEventValidation,
  validateRequest,
};
