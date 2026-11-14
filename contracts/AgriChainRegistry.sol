// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgriChainRegistry
 * @notice Educational batch traceability prototype. No tokens, payments or real data.
 * @dev A hash proves file consistency against a previously recorded fingerprint;
 *      it does not prove that the original document or physical goods are truthful.
 */
contract AgriChainRegistry {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CUSTODIAN_ROLE = keccak256("CUSTODIAN_ROLE");
    bytes32 public constant SENDER_ROLE = keccak256("SENDER_ROLE");
    bytes32 public constant RECEIVER_ROLE = keccak256("RECEIVER_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    enum Status { NONE, REGISTERED, DISPATCHED, RECEIVED, SPLIT }

    struct Batch {
        string batchId;
        string product;
        uint256 quantityKg;
        string parentBatchId;
        bytes32 documentHash;
        Status status;
        bool issueOpen;
        address createdBy;
    }

    mapping(bytes32 => Batch) private batches;
    mapping(bytes32 => mapping(address => bool)) private roles;

    event RoleGranted(bytes32 indexed role, address indexed account);
    event BatchRegistered(string indexed batchId, uint256 quantityKg, address indexed actor);
    event DocumentHashAdded(string indexed batchId, bytes32 documentHash, address indexed actor);
    event BatchDispatched(string indexed batchId, address indexed actor);
    event ReceiptConfirmed(string indexed batchId, address indexed actor);
    event BatchSplit(string indexed parentId, string childA, string childB);
    event IssueFlagged(string indexed batchId, address indexed actor, string reason);
    event IssueResolved(string indexed batchId, address indexed actor, string resolution);

    modifier onlyRole(bytes32 role) {
        require(roles[role][msg.sender], "ACCESS_DENIED");
        _;
    }

    constructor() {
        roles[ADMIN_ROLE][msg.sender] = true;
        emit RoleGranted(ADMIN_ROLE, msg.sender);
    }

    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        require(account != address(0), "ZERO_ADDRESS");
        roles[role][account] = true;
        emit RoleGranted(role, account);
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return roles[role][account];
    }

    function registerBatch(
        string calldata batchId,
        string calldata product,
        uint256 quantityKg
    ) external onlyRole(CUSTODIAN_ROLE) {
        bytes32 key = _key(batchId);
        require(bytes(batchId).length > 0, "EMPTY_BATCH_ID");
        require(bytes(product).length > 0, "EMPTY_PRODUCT");
        require(quantityKg > 0, "ZERO_QUANTITY");
        require(batches[key].status == Status.NONE, "BATCH_EXISTS");
        batches[key] = Batch({
            batchId: batchId,
            product: product,
            quantityKg: quantityKg,
            parentBatchId: "",
            documentHash: bytes32(0),
            status: Status.REGISTERED,
            issueOpen: false,
            createdBy: msg.sender
        });
        emit BatchRegistered(batchId, quantityKg, msg.sender);
    }

    function addDocumentHash(string calldata batchId, bytes32 documentHash)
        external
    {
        require(
            roles[CUSTODIAN_ROLE][msg.sender] ||
            roles[SENDER_ROLE][msg.sender] ||
            roles[RECEIVER_ROLE][msg.sender],
            "ACCESS_DENIED"
        );
        Batch storage b = _batch(batchId);
        require(documentHash != bytes32(0), "EMPTY_HASH");
        b.documentHash = documentHash;
        emit DocumentHashAdded(batchId, documentHash, msg.sender);
    }

    function dispatchBatch(string calldata batchId) external onlyRole(SENDER_ROLE) {
        Batch storage b = _batch(batchId);
        require(b.status == Status.REGISTERED, "INVALID_STATUS");
        b.status = Status.DISPATCHED;
        emit BatchDispatched(batchId, msg.sender);
    }

    function confirmReceipt(string calldata batchId) external onlyRole(RECEIVER_ROLE) {
        Batch storage b = _batch(batchId);
        require(b.status == Status.DISPATCHED, "INVALID_STATUS");
        b.status = Status.RECEIVED;
        emit ReceiptConfirmed(batchId, msg.sender);
    }

    function splitBatch(
        string calldata parentId,
        string calldata childAId,
        uint256 childAQtyKg,
        string calldata childBId,
        uint256 childBQtyKg
    ) external onlyRole(CUSTODIAN_ROLE) {
        Batch storage parent = _batch(parentId);
        require(parent.status == Status.RECEIVED, "PARENT_NOT_RECEIVED");
        require(childAQtyKg > 0 && childBQtyKg > 0, "ZERO_CHILD_QUANTITY");
        require(childAQtyKg + childBQtyKg == parent.quantityKg, "QUANTITY_MISMATCH");
        require(_key(childAId) != _key(childBId), "DUPLICATE_CHILD_ID");
        require(batches[_key(childAId)].status == Status.NONE, "CHILD_A_EXISTS");
        require(batches[_key(childBId)].status == Status.NONE, "CHILD_B_EXISTS");

        _createChild(childAId, parent.product, childAQtyKg, parentId);
        _createChild(childBId, parent.product, childBQtyKg, parentId);
        parent.status = Status.SPLIT;
        emit BatchSplit(parentId, childAId, childBId);
    }

    function flagIssue(string calldata batchId, string calldata reason)
        external onlyRole(REVIEWER_ROLE)
    {
        Batch storage b = _batch(batchId);
        require(!b.issueOpen, "ISSUE_ALREADY_OPEN");
        require(bytes(reason).length > 0, "EMPTY_REASON");
        b.issueOpen = true;
        emit IssueFlagged(batchId, msg.sender, reason);
    }

    function resolveIssue(string calldata batchId, string calldata resolution)
        external onlyRole(REVIEWER_ROLE)
    {
        Batch storage b = _batch(batchId);
        require(b.issueOpen, "NO_OPEN_ISSUE");
        require(bytes(resolution).length > 0, "EMPTY_RESOLUTION");
        b.issueOpen = false;
        emit IssueResolved(batchId, msg.sender, resolution);
    }

    function getBatch(string calldata batchId) external view returns (Batch memory) {
        return _batchView(batchId);
    }

    function _createChild(
        string calldata childId,
        string memory product,
        uint256 quantityKg,
        string calldata parentId
    ) private {
        require(bytes(childId).length > 0, "EMPTY_BATCH_ID");
        batches[_key(childId)] = Batch({
            batchId: childId,
            product: product,
            quantityKg: quantityKg,
            parentBatchId: parentId,
            documentHash: bytes32(0),
            status: Status.REGISTERED,
            issueOpen: false,
            createdBy: msg.sender
        });
    }

    function _batch(string calldata batchId) private view returns (Batch storage b) {
        b = batches[_key(batchId)];
        require(b.status != Status.NONE, "BATCH_NOT_FOUND");
    }

    function _batchView(string calldata batchId) private view returns (Batch memory) {
        Batch storage b = batches[_key(batchId)];
        require(b.status != Status.NONE, "BATCH_NOT_FOUND");
        return b;
    }

    function _key(string memory batchId) private pure returns (bytes32) {
        return keccak256(bytes(batchId));
    }
}
