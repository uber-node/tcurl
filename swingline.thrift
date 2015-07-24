// "Primitive" Types and Typedefs

typedef string uuid;
typedef string url;

// Generic Structs and Enums

enum ProfileType {
  Personal = 0,
  Business = 1,
  ManagedBusiness = 2
}

enum BillingMode {
  Centralized = 0,
  Decentralized = 1
}

enum SummaryPeriod {
  Weekly = 0,
  Monthly = 1
}

enum IconType {
  briefcase = 0,
  heart = 1
}

struct Image {
  1: required string url;
  2: optional i16 width;
  3: optional i16 height;
}

struct Theme {
  1: optional string color;
  2: optional string initials;
  3: optional IconType icon;
  4: optional map<string, list<Image>> logos; // Map keys will be 'Thumbnail' and 'Large'
}

/* For managed profile types, the managed entity attributes that are also common attributes (e.g theme, name),
 may take precendence over the attributes defined on the top level. */
struct ManagedBusinessProfileAttributes {
  1: optional string name;
  2: optional Theme theme;
  3: optional BillingMode billingMode;
}

struct Profile {
  1: required uuid uuid;
  2: required ProfileType type;

  /* Common profile attributes */
  3: optional string status;
  4: optional string name;
  5: optional bool isVerified;
  6: optional string email;
  7: optional Theme theme;
  8: optional uuid defaultPaymentProfileUuid;
  9: optional set<SummaryPeriod> selectedSummaryPeriods;
  10: optional bool concurEnabled;
  11: optional uuid entityUuid;

  /* Entity profile attributes (managed attributes only)  */
  12: optional ManagedBusinessProfileAttributes managedBusinessProfileAttributes;
}

struct ProfileThemeOptions {
  1: required uuid profileUuid;
  2: optional list<string> colors;
  3: optional list<IconType> icons;
  4: optional string initials;
  5: optional map<string, list<Image>> logos; // Map keys will be 'Thumbnail' and 'Large'
}

// Exceptions

exception NotAuthorizedException {
  1: required string type;
  2: required string message;
  3: required string name;
}
exception InvalidRequestException {
  1: required string type;
  2: required string message;
  3: required string name;
}
exception CannotDeleteException {
  1: required string type;
  2: required string message;
  3: required string name;
}
exception NotImplementedException {
  1: required string type;
  2: required string message;
  3: required string name;
}
exception NotFoundException {
  1: required string type;
  2: required string message;
  3: required string name;
}

// Request and Response Objects

// READ PROFILES

struct GetProfilesRequest {
  1: required uuid userUuid;
}

struct GetProfilesResponse {
  1: required list<Profile> profiles;
}

struct GetProfileRequest {
  1: required uuid userUuid;
  2: required uuid profileUuid;
}

struct GetProfileResponse {
  1: required Profile profile;
}

// READ PROFILE THEME OPTIONS

struct GetProfileThemeOptionsRequest {
  1: required uuid userUuid;
}

struct GetProfileThemeOptionsResponse {
  1: required list<ProfileThemeOptions> profileThemeOptions;
}

// CREATE PROFILE

/**
 * Request to create a profile. We chose this pattern to take advantage of thrift's type checking as much
 * as possible, whilst leaving the response to the client as simple as possible. There will be some duplication
 * of fields, but that's the price we pay.
 */
struct CreateProfileRequest {
  1: required uuid userUuid;
  2: required ProfileType type;
  3: optional string email;

  4: optional string status;
  5: optional bool isVerified;
  7: optional string name;
  8: optional Theme theme;
  9: optional uuid defaultPaymentProfileUuid;
  10: optional set<SummaryPeriod> selectedSummaryPeriods;
  11: optional bool concurEnabled;
  12: optional uuid entityUuid;

  // Managed profile attributes only
  13: optional ManagedBusinessProfileAttributes managedBusinessProfileAttributes;
}

struct CreateProfileResponse {
  1: required Profile profile;
}

// UPDATE PROFILE

struct UpdateProfileRequest {
  1: required uuid userUuid;
  2: required Profile profile;
}

struct UpdateProfileResponse {
  1: required Profile profile;
}

// DELETE PROFILE

struct DeleteProfileRequest {
  1: required uuid userUuid;
  2: required uuid profileUuid;
}

struct DeleteProfileResponse {
  1: required bool success;
}

// Service Definition

/**
 * Swingline service.
 * WARNING: Until we have proper authorization, we assume UUID supplied with these
 * requests is the the UUID for the currently logged in user. As such, this should
 * NEVER be called with a request based on user input. For the current user, use the
 * value returned by the authenticating system.
 */
service Swingline {

  /**
   * Standard health check.
   */
  bool isHealthy();

  /**
   * Load profiles for a given user.
   */
  GetProfilesResponse getProfiles(
    1: required GetProfilesRequest request;
  )
  throws (
    1: NotAuthorizedException notAuthorized;
  )

  GetProfileResponse getProfile(
    1: required GetProfileRequest request;
  )
  throws (
    1: NotAuthorizedException notAuthorized;
    2: NotFoundException notFound;
  )

  /**
   * Fetch theme options for the profiles of a given user.
   */
   GetProfileThemeOptionsResponse getProfileThemeOptions(
     1: required GetProfileThemeOptionsRequest request;
   )
   throws (
     1: NotAuthorizedException notAuthorized;
   )

  /**
   * Create a business profile for the given user.
   * Must supply a valid email. For now, we will assume we're creating an org
   * in decentralized billing mode. In the future, we  may also want to throw
   * on public emails.
   */
  CreateProfileResponse createProfile(
    1: required CreateProfileRequest request;
  )
  throws (
    1: NotAuthorizedException notAuthorized;
    2: InvalidRequestException invalidRequest;
  )

  /**
   * Update a profile for the given user.
   * The update follows the same semantics as a PATCH request. Only supplied attributes
   * will be updated.
   * Throws NotAuthorizedException when downstream systems fail authz checks.
   */
  UpdateProfileResponse updateProfile(
    1: required UpdateProfileRequest request;
  )
  throws (
    1: NotAuthorizedException notAuthorized;
    2: InvalidRequestException invalidRequest;
  )

  /**
   * Delete a profile for the given user.
   * Throws NotAuthorizedException when downstream systems fail authz checks.
   * Throws CannotDeleteException if user tries to delete their only profile.
   */
  DeleteProfileResponse deleteProfile(
    1: required DeleteProfileRequest request;
  )
  throws (
    1: NotAuthorizedException notAuthorized;
    2: CannotDeleteException cannotDelete;
  )

}
