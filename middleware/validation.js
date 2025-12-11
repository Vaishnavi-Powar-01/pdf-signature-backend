const validateSignPdf = (req, res, next) => {
  const { documentId, fields } = req.body;
  
  const errors = [];
  
  if (!documentId) {
    errors.push('documentId is required');
  }
  
  if (!fields || !Array.isArray(fields)) {
    errors.push('fields array is required');
  } else {
    fields.forEach((field, index) => {
      if (!field.type) {
        errors.push(`Field ${index}: type is required`);
      }
      if (!field.position || typeof field.position.x !== 'number' || typeof field.position.y !== 'number') {
        errors.push(`Field ${index}: valid position object with x and y coordinates is required`);
      }
      if (!field.size || typeof field.size.width !== 'number' || typeof field.size.height !== 'number') {
        errors.push(`Field ${index}: valid size object with width and height is required`);
      }
    });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors: errors
    });
  }
  
  next();
};

const validateCoordinates = (req, res, next) => {
  const { coordinates } = req.body;
  
  if (!coordinates) {
    return res.status(400).json({
      success: false,
      error: 'Coordinates object is required'
    });
  }
  
  const { x, y, width, height, page } = coordinates;
  
  if (typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'Valid x and y coordinates are required'
    });
  }
  
  if (width && typeof width !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'Width must be a number'
    });
  }
  
  if (height && typeof height !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'Height must be a number'
    });
  }
  
  if (page && (typeof page !== 'number' || page < 1)) {
    return res.status(400).json({
      success: false,
      error: 'Page must be a positive number'
    });
  }
  
  next();
};

module.exports = {
  validateSignPdf,
  validateCoordinates
};