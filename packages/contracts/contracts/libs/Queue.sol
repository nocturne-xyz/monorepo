// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.5;

library QueueLib {
    /**
     * @notice Queue struct
     * @dev Internally keeps track of the `first` and `last` elements through
     * indices and a mapping of indices to enqueued elements.
     **/
    struct Queue {
        uint128 first;
        uint128 last;
        mapping(uint256 => uint256) queue;
    }

    /**
     * @notice Initializes the queue
     * @dev Empty state denoted by self.first > q.last. Queue initialized
     * with self.first = 1 and self.last = 0.
     **/
    function initialize(Queue storage self) internal {
        if (self.first == 0) {
            self.first = 1;
        }
    }

    /**
     * @notice Enqueues a single new element
     * @param item New element to be enqueued
     * @return last Index of newly enqueued element
     **/
    function enqueue(
        Queue storage self,
        uint256 item
    ) internal returns (uint128 last) {
        last = self.last + 1;
        self.last = last;
        if (item != uint256(0)) {
            // saves gas if we're queueing 0
            self.queue[last] = item;
        }
    }

    /**
     * @notice Dequeues element at front of queue
     * @dev Removes dequeued element from storage
     * @return item Dequeued element
     **/
    function dequeue(Queue storage self) internal returns (uint256 item) {
        uint128 last = self.last;
        uint128 first = self.first;
        require(length(last, first) != 0, "Empty");
        item = self.queue[first];
        if (item != uint256(0)) {
            // saves gas if we're dequeuing 0
            delete self.queue[first];
        }
        self.first = first + 1;
    }

    /**
     * @notice Batch enqueues several elements
     * @param items Array of elements to be enqueued
     * @return last Index of last enqueued element
     **/
    function enqueue(
        Queue storage self,
        uint256[] memory items
    ) internal returns (uint128 last) {
        last = self.last;
        for (uint256 i = 0; i < items.length; i += 1) {
            last += 1;
            uint256 item = items[i];
            if (item != uint256(0)) {
                self.queue[last] = item;
            }
        }
        self.last = last;
    }

    /**
     * @notice Batch dequeues 2 elements
     * @dev Reverts if `number` > queue length
     * @return Array of dequeued elements
     **/
    function dequeue2(Queue storage self) internal returns (uint256[2] memory) {
        uint128 last = self.last;
        uint128 first = self.first;
        // Cannot underflow unless state is corrupted
        require(length(last, first) >= 2, "Insufficient");

        uint256[2] memory items;

        for (uint256 i = 0; i < 2; i++) {
            items[i] = self.queue[first];
            delete self.queue[first];
            first++;
        }
        self.first = first;
        return items;
    }

    /**
     * @notice Batch dequeues 8 elements
     * @dev Reverts if `number` > queue length
     * @return Array of dequeued elements
     **/
    function dequeue8(Queue storage self) internal returns (uint256[8] memory) {
        uint128 last = self.last;
        uint128 first = self.first;
        // Cannot underflow unless state is corrupted
        require(length(last, first) >= 8, "Insufficient");

        uint256[8] memory items;

        for (uint256 i = 0; i < 8; i++) {
            items[i] = self.queue[first];
            delete self.queue[first];
            first++;
        }
        self.first = first;
        return items;
    }

    /**
     * @notice Batch dequeues 16 elements
     * @dev Reverts if `number` > queue length
     * @return Array of dequeued elements
     **/
    function dequeue16(
        Queue storage self
    ) internal returns (uint256[16] memory) {
        uint128 last = self.last;
        uint128 first = self.first;
        // Cannot underflow unless state is corrupted
        require(length(last, first) >= 16, "Insufficient");

        uint256[16] memory items;

        for (uint256 i = 0; i < 16; i++) {
            items[i] = self.queue[first];
            delete self.queue[first];
            first++;
        }
        self.first = first;
        return items;
    }

    /**
     * @notice Returns true if `item` is in the queue and false if otherwise
     * @dev Linearly scans from self.first to self.last looking for `item`
     * @param item Item being searched for in queue
     * @return True if `item` currently exists in queue, false if otherwise
     **/
    function contains(
        Queue storage self,
        uint256 item
    ) internal view returns (bool) {
        for (uint256 i = self.first; i <= self.last; i++) {
            if (self.queue[i] == item) {
                return true;
            }
        }
        return false;
    }

    /// @notice Returns last item in queue
    /// @dev Returns uint256(0) if queue empty
    function lastItem(Queue storage self) internal view returns (uint256) {
        return self.queue[self.last];
    }

    /// @notice Returns element at front of queue without removing element
    /// @dev Reverts if queue is empty
    function peek(Queue storage self) internal view returns (uint256 item) {
        require(!isEmpty(self), "Queue is empty");
        item = self.queue[self.first];
    }

    /// @notice Returns true if queue is empty and false if otherwise
    function isEmpty(Queue storage self) internal view returns (bool) {
        return self.last < self.first;
    }

    /// @notice Returns number of elements in queue
    function length(Queue storage self) internal view returns (uint256) {
        uint128 last = self.last;
        uint128 first = self.first;
        // Cannot underflow unless state is corrupted
        return length(last, first);
    }

    /// @notice Returns number of elements between `last` and `first` (used internally)
    function length(
        uint128 last,
        uint128 first
    ) internal pure returns (uint256) {
        return uint256(last + 1 - first);
    }
}
